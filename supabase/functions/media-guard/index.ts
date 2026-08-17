// Admin-protected media operations: usage check, safe delete, safe rename, safe replace (compression).
// Never deletes/renames a file without server-side re-verification, and never leaves references stale.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

type Usage = { entity: string; label: string; id: string; field: string };

// Every public table + column that a dashboard editor can put a media URL/filename into.
// Audited against the production schema — no speculative columns.
// Deliberately NOT scanned:
//   booking_leads / conversion_events → visitor-submitted data, never an editor image source
//   content_history                   → immutable audit log; reported separately, never blocking
const SCANS: { table: string; label: string; nameField: string; fields: string[] }[] = [
  { table: "blog_posts", label: "Blog post", nameField: "title", fields: ["content", "content_en", "content_ru", "meta_description", "meta_description_en", "meta_description_ru"] },
  { table: "site_content", label: "Site content", nameField: "label", fields: ["value_es", "value_en", "value_ru"] },
  { table: "page_images", label: "Image / carousel", nameField: "collection_key", fields: ["image_url", "alt_text"] },
  { table: "services", label: "Service", nameField: "title", fields: ["description", "description_en", "description_ru"] },
  { table: "faqs", label: "FAQ", nameField: "question", fields: ["question", "question_en", "question_ru", "answer", "answer_en", "answer_ru"] },
  { table: "promotions", label: "Promotion", nameField: "badge_text", fields: ["badge_text", "badge_text_en", "badge_text_ru"] },
  { table: "testimonials", label: "Testimonial", nameField: "name", fields: ["quote", "quote_en", "quote_ru"] },
];

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

type Backup = { table: string; id: string; values: Record<string, string> };

/**
 * Rewrites every reference from oldName → newName across all content-bearing fields.
 * Handles raw filename, full public URL (the filename inside it) and URL-encoded filename.
 * Returns per-row backups so the caller can compensate if a later step fails.
 */
async function rewriteReferences(
  admin: Client,
  oldName: string,
  newName: string,
): Promise<{ backups: Backup[]; updated: number }> {
  const backups: Backup[] = [];
  let updated = 0;
  for (const scan of SCANS) {
    for (const row of await matchingRows(admin, scan, oldName)) {
      const before: Record<string, string> = {};
      const patch: Record<string, string> = {};
      for (const f of scan.fields) {
        const value = row[f];
        if (typeof value !== "string") continue;
        let next = value;
        next = next.split(oldName).join(newName);
        next = next.split(encodeURIComponent(oldName)).join(encodeURIComponent(newName));
        if (next !== value) {
          before[f] = value;
          patch[f] = next;
        }
      }
      if (!Object.keys(patch).length) continue;
      const { error } = await admin.from(scan.table).update(patch).eq("id", row.id);
      if (error) throw Object.assign(new Error(`${scan.table}: ${error.message}`), { backups });
      backups.push({ table: scan.table, id: String(row.id), values: before });
      updated += Object.keys(patch).length;
    }
  }
  return { backups, updated };
}

async function restoreReferences(admin: Client, backups: Backup[]) {
  for (const b of backups) {
    await admin.from(b.table).update(b.values).eq("id", b.id);
  }
}

// content_history is an append-only audit log. A hit there means an OLD version of some
// content referenced this file: restoring that version after deletion/rename would show a broken
// image. It must never block the operation (history rows are never edited, so the block would be
// permanent) — instead it is surfaced as a non-blocking warning count.
async function countHistoryReferences(admin: Client, fileName: string): Promise<number> {
  const { data, error } = await admin.rpc("count_media_history_refs", { _needle: fileName });
  if (error) return 0; // never let the advisory lookup break the guard
  return typeof data === "number" ? data : 0;
}

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;

function validateName(name: string): string | null {
  if (!name) return "Name cannot be empty";
  if (name.includes("/") || name.includes("\\") || name.includes("..")) return "Name cannot contain paths";
  if (!NAME_RE.test(name)) return "Use letters, numbers, dot, dash and underscore only";
  if (!/\.[A-Za-z0-9]{2,5}$/.test(name)) return "Name must keep a file extension";
  return null;
}

async function objectExists(admin: Client, name: string): Promise<boolean> {
  const { data } = await admin.storage.from("media").list("", { search: name, limit: 100 });
  return (data ?? []).some((f: { name: string }) => f.name === name);
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
      if (!(await objectExists(admin, fileName))) return json({ error: "Source file not found" }, 404);
      if (await objectExists(admin, newName)) return json({ error: "A file with that name already exists" }, 409);

      const { error: copyError } = await admin.storage.from("media").copy(fileName, newName);
      if (copyError) return json({ error: copyError.message }, 500);

      let updated = 0;
      try {
        updated = (await rewriteReferences(admin, fileName, newName)).updated;
      } catch (e) {
        const backups = (e as { backups?: Backup[] }).backups ?? [];
        await restoreReferences(admin, backups);
        await admin.storage.from("media").remove([newName]);
        return json({ error: `Rename rolled back: ${(e as Error).message}` }, 500);
      }

      const { error: rmError } = await admin.storage.from("media").remove([fileName]);
      if (rmError) {
        // References already point at the new object which exists — keep them, report the leftover.
        return json({ fileName, newName, renamed: true, updatedReferences: updated, warning: rmError.message });
      }
      const historyReferences = await countHistoryReferences(admin, fileName);
      return json({ fileName, newName, renamed: true, updatedReferences: updated, historyReferences });
    }

    // ---- replace (smart compression commit) ------------------------------
    const newName = typeof body?.newName === "string" && body.newName.trim() ? body.newName.trim() : fileName;
    const invalid = validateName(newName);
    if (invalid) return json({ error: invalid }, 400);
    const contentBase64 = typeof body?.contentBase64 === "string" ? body.contentBase64 : "";
    const contentType = typeof body?.contentType === "string" ? body.contentType : "application/octet-stream";
    if (!contentBase64) return json({ error: "Missing image data" }, 400);
    if (!/^image\/(webp|jpeg|png)$/.test(contentType)) return json({ error: "Unsupported output format" }, 400);

    const bytes = decodeBase64(contentBase64);
    const originalSize = Number(body?.originalSize ?? 0);
    if (!originalSize || bytes.byteLength >= originalSize) {
      return json({ error: "Compressed result is not smaller — file left untouched" }, 409);
    }
    if (!(await objectExists(admin, fileName))) return json({ error: "Source file not found" }, 404);
    const renaming = newName !== fileName;
    if (renaming && (await objectExists(admin, newName))) {
      return json({ error: "A file with that name already exists" }, 409);
    }

    const { error: upError } = await admin.storage
      .from("media")
      .upload(newName, bytes, { contentType, cacheControl: "3600", upsert: !renaming });
    if (upError) return json({ error: upError.message }, 500);

    let updated = 0;
    if (renaming) {
      try {
        updated = (await rewriteReferences(admin, fileName, newName)).updated;
      } catch (e) {
        const backups = (e as { backups?: Backup[] }).backups ?? [];
        await restoreReferences(admin, backups);
        await admin.storage.from("media").remove([newName]);
        return json({ error: `Compression rolled back: ${(e as Error).message}` }, 500);
      }
      const { error: rmError } = await admin.storage.from("media").remove([fileName]);
      if (rmError) {
        return json({ fileName, newName, replaced: true, updatedReferences: updated, newSize: bytes.byteLength, originalSize, warning: rmError.message });
      }
    }

    const historyReferences = await countHistoryReferences(admin, fileName);
    return json({
      fileName,
      newName,
      replaced: true,
      updatedReferences: updated,
      originalSize,
      newSize: bytes.byteLength,
      historyReferences,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
