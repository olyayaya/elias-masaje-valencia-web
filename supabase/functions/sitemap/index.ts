import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildSitemapXml, type ExtraUrl } from "./build-sitemap.ts";

// Build headers with an explicit Headers instance — the edge gateway has been
// observed dropping the content type from a plain object literal on GET.
function xmlHeaders(body: string): Headers {
  const headers = new Headers();
  headers.set("content-type", "text/xml; charset=utf-8");
  headers.set("cache-control", "public, max-age=60, s-maxage=60");
  headers.set("access-control-allow-origin", "*");
  headers.set("content-length", String(new TextEncoder().encode(body).byteLength));
  headers.set("x-content-type-options", "nosniff");
  return headers;
}

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const nowIso = new Date().toISOString();

    const { data: posts, error } = await supabase
      .from("blog_posts")
      .select("slug, updated_at, published_at, status, hidden")
      .eq("status", "published")
      .eq("hidden", false)
      .not("slug", "is", null)
      .neq("slug", "")
      .lte("published_at", nowIso)
      .order("published_at", { ascending: false, nullsFirst: false });

    if (error) throw error;

    // Optional extra URLs configured from the dashboard (sitemap_config JSON blob).
    let extraUrls: ExtraUrl[] = [];
    try {
      const { data: cfgRow } = await supabase
        .from("site_content")
        .select("value_es")
        .eq("content_key", "sitemap_config")
        .maybeSingle();
      const raw = cfgRow?.value_es?.trim();
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.extraUrls)) {
          extraUrls = parsed.extraUrls.filter(
            (u: ExtraUrl) => u && typeof u.loc === "string" && u.loc.startsWith("http"),
          );
        }
      }
    } catch (e) {
      console.warn("sitemap_config parse failed, ignoring:", e);
    }

    const xml = buildSitemapXml(posts ?? [], extraUrls);

    return new Response(xml, { status: 200, headers: xmlHeaders(xml) });
  } catch (err) {
    console.error("Sitemap error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>\n<error>${message
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</error>`,
      {
        status: 500,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
});
