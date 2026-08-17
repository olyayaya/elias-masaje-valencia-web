// Admin-protected media operations: usage check, safe delete, safe rename, safe replace (compression).
// Every mutating path re-verifies server-side. Reference rewriting + alias recording happen inside a
// single PostgreSQL transaction (rewrite_media_references), so references can never be half-updated.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  evaluateSaving,
  magicMatches,
  videoMagicMatches,
  MAX_UPLOAD_BYTES,
  MAX_VIDEO_BYTES,
  validateName,
  validateOutputType,
  validateVideoOutputType,
  validateVideoSourceName,
  validateStagedName,
  validateRenameExtension,
  backupNameFor,
  SCANS,
} from "./rules.ts";
import { promoteSameName } from "./promote.ts";



const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

type Usage = { entity: string; label: string; id: string; field: string };


type Client = ReturnType<typeof createClient>;


const nameVariants = (name: string) => Array.from(new Set([name, encodeURIComponent(name)]));

async function findUsages(admin: Client, fileName: string): Promise<Usage[]> {
  const usages: Usage[] = [];
  for (const scan of SCANS) {
    for (const row of await matchingRows(admin, scan, fileName)) {
      for (const f of scan.fields) {
        const value = row[f];
        if (typeof value === "string" && nameVariants(fileName).some((v) => value.includes(v))) {
          usages.push({
            entity: scan.label,
            label: String(row[scan.nameField] ?? row.id ?? "").slice(0, 120) || String(row.id),
            id: String(row.id),
            field: f,
          });
        }
      }
    }
  }
  return usages;
}

async function matchingRows(
  admin: Client,
  scan: (typeof SCANS)[number],
  fileName: string,
): Promise<Record<string, unknown>[]> {
  const cols = Array.from(new Set(["id", scan.nameField, ...scan.fields])).join(",");
  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const variant of nameVariants(fileName)) {
    const needle = variant.replace(/[%_]/g, (m) => `\\${m}`);
    const or = scan.fields.map((f) => `${f}.ilike.%${needle}%`).join(",");
    const { data, error } = await admin.from(scan.table).select(cols).or(or);
    if (error) throw new Error(`${scan.table}: ${error.message}`);
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      const id = String(row.id);
      if (seen.has(id)) continue;
      seen.add(id);
      rows.push(row);
    }
  }
  return rows;
}

/**
 * Single transactional rewrite of every content reference + the alias row.
 * Postgres rolls the whole function back on any error, so there is no partial state
 * and no client-side compensation array to get wrong.
 */
async function rewriteReferences(
  admin: Client,
  oldName: string,
  newName: string,
  actor: string,
): Promise<number> {
  const { data, error } = await admin.rpc("rewrite_media_references", {
    _old: oldName,
    _new: newName,
    _old_enc: encodeURIComponent(oldName),
    _new_enc: encodeURIComponent(newName),
    _actor: actor,
  });
  if (error) throw new Error(error.message);
  return typeof data === "number" ? data : 0;
}

// content_history is an append-only audit log — snapshots are never rewritten. Restores stay safe
// because the dashboard resolves old names through media_aliases before applying a snapshot.
// The count is still reported so the admin sees the honest state.
async function countHistoryReferences(admin: Client, fileName: string): Promise<number> {
  const { data, error } = await admin.rpc("count_media_history_refs", { _needle: fileName });
  if (error) return 0; // never let the advisory lookup break the guard
  return typeof data === "number" ? data : 0;
}


type Stat = { found: boolean; size: number };

/**
 * Exact-name lookup in the media bucket. Storage API failures are thrown (500), a clean
 * "no such object" answer returns found:false (404) — the two are never conflated.
 */
async function statObject(admin: Client, name: string): Promise<Stat> {
  const { data, error } = await admin.storage.from("media").list("", { search: name, limit: 100 });
  if (error) throw new Error(`Storage lookup failed: ${error.message}`);
  const hit = (data ?? []).find((f: { name: string }) => f.name === name) as
    | { name: string; metadata?: { size?: number } }
    | undefined;
  if (!hit) return { found: false, size: 0 };
  return { found: true, size: Number(hit.metadata?.size ?? 0) };
}

function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Reads only the first bytes of a stored object so container sniffing never buffers a whole
 * video. A server that ignores the Range header answers 200 with the full body — in that case
 * we read a single stream chunk and cancel, so a 250 MB object never lands in memory.
 */
async function readHead(admin: Client, name: string, bytes = 64): Promise<Uint8Array> {
  const { data, error } = await admin.storage.from("media").createSignedUrl(name, 60);
  if (error || !data?.signedUrl) throw new Error(`Could not read uploaded file: ${error?.message ?? "no url"}`);
  const res = await fetch(data.signedUrl, { headers: { Range: `bytes=0-${bytes - 1}` } });
  if (!res.ok && res.status !== 206) throw new Error(`Could not read uploaded file (${res.status})`);

  const body = res.body;
  if (!body) return new Uint8Array(0);
  const reader = body.getReader();
  const head = new Uint8Array(bytes);
  let total = 0;
  try {
    while (total < bytes) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.length) continue;
      // Only the bytes we promised are ever retained: a server that ignores Range can hand
      // us a 10 MB first chunk, and all but the first `bytes` of it are dropped right here.
      const take = Math.min(value.length, bytes - total);
      head.set(value.subarray(0, take), total);
      total += take;
    }
  } finally {
    // Stops the download immediately — nothing beyond the head is ever transferred.
    await reader.cancel().catch(() => undefined);
  }

  return head.subarray(0, total);
}


/** Supabase caps a plain select at 1000 rows — page explicitly or usage silently under-counts. */
const PAGE_SIZE = 1000;

/**
 * One pass over every scanned table that counts references for MANY filenames at once.
 * Powers the library's used/unused filter without N round-trips.
 */
async function usageCounts(admin: Client, names: string[]): Promise<Record<string, number>> {
  const counts: Record<string, number> = Object.fromEntries(names.map((n) => [n, 0]));
  const variants = names.map((n) => ({ n, needles: nameVariants(n) }));
  for (const scan of SCANS) {
    const cols = Array.from(new Set(["id", ...scan.fields])).join(",");
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await admin
        .from(scan.table)
        .select(cols)
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(`${scan.table}: ${error.message}`);
      const rows = (data ?? []) as Record<string, unknown>[];
      for (const row of rows) {
        for (const f of scan.fields) {
          const value = row[f];
          if (typeof value !== "string" || !value) continue;
          for (const { n, needles } of variants) {
            if (needles.some((v) => value.includes(v))) counts[n] += 1;
          }
        }
      }
      if (rows.length < PAGE_SIZE) break;
    }
  }
  return counts;
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const { data: isAdmin, error: roleError } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (roleError) return json({ error: roleError.message }, 500);
    if (!isAdmin) return json({ error: "Forbidden — admin only" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    if (!["check", "delete", "rename", "replace", "usage-batch", "commit-video"].includes(action)) {
      return json({ error: "Invalid action" }, 400);
    }

    // ---- usage-batch: one scan, many filenames (library filters) ---------
    if (action === "usage-batch") {
      const raw = Array.isArray(body?.fileNames) ? body.fileNames : [];
      const names = Array.from(
        new Set(
          raw
            .filter((n: unknown): n is string => typeof n === "string")
            .map((n: string) => n.trim())
            .filter((n: string) => n && n.length <= 300 && !n.includes("/")),
        ),
      ) as string[];
      if (!names.length) return json({ error: "No file names provided" }, 400);
      if (names.length > 500) return json({ error: "Too many file names (max 500)" }, 400);
      return json({ usage: await usageCounts(admin, names) });
    }

    const fileName = typeof body?.fileName === "string" ? body.fileName.trim() : "";
    if (!fileName || fileName.length > 300 || fileName.includes("/")) {
      return json({ error: "Invalid fileName" }, 400);
    }

    // ---- commit-video: promote a staged upload over an existing object ---
    if (action === "commit-video") {
      const stagedName = typeof body?.stagedName === "string" ? body.stagedName.trim() : "";
      const newName = typeof body?.newName === "string" && body.newName.trim() ? body.newName.trim() : fileName;
      const contentType = typeof body?.contentType === "string" ? body.contentType.toLowerCase() : "";
      const enforceSaving = body?.enforceSaving !== false;

      // The staged object must carry the reserved prefix bound to THIS user, and can never
      // be an existing media name.
      const stagedInvalid = validateStagedName(stagedName, user.id, [fileName, newName]);
      if (stagedInvalid) return json({ error: stagedInvalid }, 400);
      const invalidNew = validateName(newName);
      if (invalidNew) return json({ error: invalidNew }, 400);
      // The *source* being replaced must itself be a container we support.
      const sourceInvalid = validateVideoSourceName(fileName);
      if (sourceInvalid) return json({ error: sourceInvalid }, 400);
      const typeError = validateVideoOutputType(contentType, newName);
      if (typeError) {
        await admin.storage.from("media").remove([stagedName]);
        return json({ error: typeError }, 400);
      }

      const cleanup = async () => { await admin.storage.from("media").remove([stagedName]); };

      const staged = await statObject(admin, stagedName);
      if (!staged.found) return json({ error: "Uploaded video not found" }, 404);
      if (staged.size > MAX_VIDEO_BYTES) {
        await cleanup();
        return json({ error: `Video is too large — the limit is ${MAX_VIDEO_BYTES / (1024 * 1024)} MB` }, 413);
      }

      // The bytes really in storage must match the declared container (client MIME is never trusted).
      const head = await readHead(admin, stagedName);
      if (!videoMagicMatches(contentType, head)) {
        await cleanup();
        return json({ error: `Uploaded data does not look like ${contentType}` }, 400);
      }

      const src = await statObject(admin, fileName);
      if (!src.found) {
        await cleanup();
        return json({ error: "Source file not found" }, 404);
      }
      if (enforceSaving) {
        const verdict = evaluateSaving(src.size, staged.size);
        if (!verdict.ok) {
          await cleanup();
          return json({ error: verdict.message, alreadyCompressed: verdict.alreadyCompressed, originalSize: src.size, newSize: staged.size }, 409);
        }
      }

      const renaming = newName !== fileName;
      if (renaming && (await statObject(admin, newName)).found) {
        await cleanup();
        return json({ error: "A file with that name already exists" }, 409);
      }

      const bucket = admin.storage.from("media");
      let updated = 0;

      if (!renaming) {
        // Same name: back up first, and restore the original if the promotion fails.
        const backup = backupNameFor(user.id, crypto.randomUUID(), fileName);
        const result = await promoteSameName(
          {
            copy: (from, to) => bucket.copy(from, to).then((r) => ({ error: r.error ? { message: r.error.message } : null })),
            remove: (names) => bucket.remove(names).then((r) => ({ error: r.error ? { message: r.error.message } : null })),
          },
          { staged: stagedName, target: fileName, backup },
        );
        if (!result.ok) return json({ error: result.error, restored: result.restored }, 500);
      } else {
        const { error: copyError } = await bucket.copy(stagedName, newName);
        if (copyError) {
          // Staged object is deliberately kept so nothing is lost if the swap failed.
          return json({ error: `${copyError.message} — the uploaded file is still available as ${stagedName}` }, 500);
        }
        try {
          updated = await rewriteReferences(admin, fileName, newName, user.id);
        } catch (e) {
          await bucket.remove([newName]);
          await cleanup();
          return json({ error: `Video replacement rolled back: ${(e as Error).message}` }, 500);
        }
      }

      const historyReferences = await countHistoryReferences(admin, fileName);
      let warning: string | undefined;
      if (renaming) {
        await cleanup();
        const { error: rmError } = await bucket.remove([fileName]);
        if (rmError) warning = `Old object could not be removed: ${rmError.message}`;
      }
      return json({
        fileName,
        newName,
        replaced: true,
        updatedReferences: updated,
        aliased: renaming,
        originalSize: src.size,
        newSize: staged.size,
        historyReferences,
        ...(warning ? { warning } : {}),
      });
    }


    if (action === "check" || action === "delete") {
      const usages = await findUsages(admin, fileName);
      const historyReferences = await countHistoryReferences(admin, fileName);
      if (action === "check") return json({ fileName, inUse: usages.length > 0, usages, historyReferences });

      // delete → usage is re-scanned here, server-side, immediately before the remove call
      if (usages.length > 0) return json({ fileName, deleted: false, inUse: true, usages, historyReferences }, 409);

      const { error: delError } = await admin.storage.from("media").remove([fileName]);
      if (delError) return json({ error: delError.message }, 500);
      return json({ fileName, deleted: true, inUse: false, usages: [], historyReferences });
    }

    // ---- rename ----------------------------------------------------------
    if (action === "rename") {
      const newName = typeof body?.newName === "string" ? body.newName.trim() : "";
      const invalid = validateName(newName);
      if (invalid) return json({ error: invalid }, 400);
      if (newName === fileName) return json({ error: "New name is identical" }, 400);
      // Server-side extension guard: format changes must go through the compression flow.
      const extError = validateRenameExtension(fileName, newName);
      if (extError) return json({ error: extError }, 400);


      const source = await statObject(admin, fileName);
      if (!source.found) return json({ error: "Source file not found" }, 404);
      if ((await statObject(admin, newName)).found) {
        return json({ error: "A file with that name already exists" }, 409);
      }

      const { error: copyError } = await admin.storage.from("media").copy(fileName, newName);
      if (copyError) return json({ error: copyError.message }, 500);

      let updated = 0;
      try {
        updated = await rewriteReferences(admin, fileName, newName, user.id);
      } catch (e) {
        // The RPC is a single transaction: nothing was committed. Only the new object must go.
        await admin.storage.from("media").remove([newName]);
        return json({ error: `Rename rolled back: ${(e as Error).message}` }, 500);
      }

      const historyReferences = await countHistoryReferences(admin, fileName);
      const { error: rmError } = await admin.storage.from("media").remove([fileName]);
      if (rmError) {
        // References already point at the new object which exists — keep them, report the leftover.
        return json({ fileName, newName, renamed: true, updatedReferences: updated, aliased: true, historyReferences, warning: `Old object could not be removed: ${rmError.message}` });
      }
      return json({ fileName, newName, renamed: true, updatedReferences: updated, aliased: true, historyReferences });
    }

    // ---- replace (smart compression commit) ------------------------------
    const newName = typeof body?.newName === "string" && body.newName.trim() ? body.newName.trim() : fileName;
    const invalid = validateName(newName);
    if (invalid) return json({ error: invalid }, 400);
    const contentBase64 = typeof body?.contentBase64 === "string" ? body.contentBase64 : "";
    const contentType = typeof body?.contentType === "string" ? body.contentType.toLowerCase() : "";
    if (!contentBase64) return json({ error: "Missing image data" }, 400);
    if (contentBase64.length > Math.ceil((MAX_UPLOAD_BYTES * 4) / 3) + 64) {
      return json({ error: `Image is too large — the limit is ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB` }, 413);
    }
    const typeError = validateOutputType(contentType, newName);
    if (typeError) return json({ error: typeError }, 400);

    const bytes = decodeBase64(contentBase64);
    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      return json({ error: `Image is too large — the limit is ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB` }, 413);
    }
    if (!magicMatches(contentType, bytes)) {
      return json({ error: `Image data does not look like ${contentType}` }, 400);
    }

    // Never trust the client-reported original size — read the real stored object.
    const source = await statObject(admin, fileName);
    if (!source.found) return json({ error: "Source file not found" }, 404);
    const originalSize = source.size;
    const verdict = evaluateSaving(originalSize, bytes.byteLength);
    if (!verdict.ok) {
      return json({ error: verdict.message, alreadyCompressed: verdict.alreadyCompressed, originalSize, newSize: bytes.byteLength }, 409);
    }


    const renaming = newName !== fileName;
    if (renaming && (await statObject(admin, newName)).found) {
      return json({ error: "A file with that name already exists" }, 409);
    }

    const { error: upError } = await admin.storage
      .from("media")
      .upload(newName, bytes, { contentType, cacheControl: "3600", upsert: !renaming });
    if (upError) return json({ error: upError.message }, 500);

    let updated = 0;
    if (renaming) {
      try {
        updated = await rewriteReferences(admin, fileName, newName, user.id);
      } catch (e) {
        await admin.storage.from("media").remove([newName]);
        return json({ error: `Compression rolled back: ${(e as Error).message}` }, 500);
      }
      const historyReferences = await countHistoryReferences(admin, fileName);
      const { error: rmError } = await admin.storage.from("media").remove([fileName]);
      if (rmError) {
        return json({ fileName, newName, replaced: true, updatedReferences: updated, aliased: true, newSize: bytes.byteLength, originalSize, historyReferences, warning: `Old object could not be removed: ${rmError.message}` });
      }
      return json({ fileName, newName, replaced: true, updatedReferences: updated, aliased: true, newSize: bytes.byteLength, originalSize, historyReferences });
    }

    const historyReferences = await countHistoryReferences(admin, fileName);
    return json({
      fileName,
      newName,
      replaced: true,
      updatedReferences: 0,
      aliased: false,
      originalSize,
      newSize: bytes.byteLength,
      historyReferences,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
