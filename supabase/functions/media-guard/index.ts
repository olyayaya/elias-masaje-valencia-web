// Admin-protected media usage check + safe delete.
// Never deletes a file that is still referenced by site content.
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

async function findUsages(admin: ReturnType<typeof createClient>, fileName: string): Promise<Usage[]> {
  const needle = fileName.replace(/[%_]/g, (m) => `\\${m}`);
  const usages: Usage[] = [];
  for (const scan of SCANS) {
    const cols = Array.from(new Set(["id", scan.nameField, ...scan.fields])).join(",");
    const or = scan.fields.map((f) => `${f}.ilike.%${needle}%`).join(",");
    const { data, error } = await admin.from(scan.table).select(cols).or(or);
    if (error) throw new Error(`${scan.table}: ${error.message}`);
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      for (const f of scan.fields) {
        const value = row[f];
        if (typeof value === "string" && value.includes(fileName)) {
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

// content_history is an append-only audit log. A hit there means an OLD version of some
// content referenced this file: restoring that version after deletion would show a broken
// image. It must never block deletion (history rows are never edited, so the block would be
// permanent) — instead it is surfaced as a non-blocking warning count.
async function countHistoryReferences(
  admin: ReturnType<typeof createClient>,
  fileName: string,
): Promise<number> {
  const { data, error } = await admin.rpc("count_media_history_refs", { _needle: fileName });
  if (error) return 0; // never let the advisory lookup break the guard
  return typeof data === "number" ? data : 0;
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
    if (action !== "check" && action !== "delete") return json({ error: "Invalid action" }, 400);

    const usages = await findUsages(admin, fileName);
    const historyReferences = await countHistoryReferences(admin, fileName);
    if (action === "check") return json({ fileName, inUse: usages.length > 0, usages, historyReferences });

    // delete → usage is re-scanned here, server-side, immediately before the remove call
    if (usages.length > 0) return json({ fileName, deleted: false, inUse: true, usages, historyReferences }, 409);

    const { error: delError } = await admin.storage.from("media").remove([fileName]);
    if (delError) return json({ error: delError.message }, 500);
    return json({ fileName, deleted: true, inUse: false, usages: [], historyReferences });

  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
