// Admin-protected media operations: usage check, safe delete, safe rename, safe replace (compression).
// Every mutating path re-verifies server-side. Reference rewriting + alias recording happen inside a
// single PostgreSQL transaction (rewrite_media_references), so references can never be half-updated.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  evaluateSaving,
  magicMatches,
  MAX_UPLOAD_BYTES,
  validateName,
  validateOutputType,
  validateRenameExtension,
  SCANS,
} from "./rules.ts";


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
    const fileName = typeof body?.fileName === "string" ? body.fileName.trim() : "";
    if (!fileName || fileName.length > 300 || fileName.includes("/")) {
      return json({ error: "Invalid fileName" }, 400);
    }
    if (!["check", "delete", "rename", "replace"].includes(action)) return json({ error: "Invalid action" }, 400);

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
