import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildSitemapXml, type ExtraUrl } from "./build-sitemap.ts";

// The function is the single source of truth for the sitemap and always
// declares application/xml; charset=utf-8.
function xmlHeaders(): Headers {
  const headers = new Headers();
  headers.set("content-type", "application/xml; charset=utf-8");
  headers.set("cache-control", "public, max-age=60, s-maxage=60");
  headers.set("access-control-allow-origin", "*");
  headers.set("x-content-type-options", "nosniff");
  return headers;
}

Deno.serve(async (req) => {
  const variant = new URL(req.url).searchParams.get("__ctv") ?? "";
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const nowIso = new Date().toISOString();

    const { data: posts, error } = await supabase
      .from("blog_posts")
      .select("slug, slug_es, slug_en, slug_ru, updated_at, published_at, status, hidden")
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

    // Gallery URLs are only advertised once the section is genuinely indexable:
    // the table has to exist AND hold at least one published item. A missing table
    // (migration still pending) or an empty gallery keeps the three URLs out.
    let includeGallery = false;
    try {
      const { count, error: galleryError } = await supabase
        .from("gallery_items")
        .select("id", { count: "exact", head: true })
        .eq("published", true);
      if (!galleryError && (count ?? 0) > 0) includeGallery = true;
    } catch (e) {
      console.warn("gallery gate check failed, omitting gallery URLs:", e);
    }

    const xml = buildSitemapXml(posts ?? [], extraUrls, new Date(), { includeGallery });

    const bytes = new TextEncoder().encode(xml);
    const base = {
      "cache-control": "public, max-age=60, s-maxage=60",
      "access-control-allow-origin": "*",
      "x-content-type-options": "nosniff",
    };
    if (variant === "1") {
      return new Response(bytes, { status: 200, headers: { ...base, "content-type": "application/xml; charset=utf-8" } });
    }
    if (variant === "2") {
      return new Response(bytes, { status: 200, headers: { ...base, "content-type": "text/xml; charset=utf-8" } });
    }
    if (variant === "3") {
      return new Response(new Blob([bytes], { type: "application/xml" }), { status: 200, headers: { ...base, "content-type": "application/xml; charset=utf-8", "content-disposition": "inline; filename=\"sitemap.xml\"" } });
    }
    if (variant === "13") {
      return new Response(bytes, { status: 200, headers: { ...base, "content-type": "application/XML; charset=utf-8" } });
    }
    if (variant === "9") {
      return new Response(bytes, { status: 200, headers: { ...base, "content-type": "Application/XML; charset=utf-8" } });
    }
    if (variant === "10") {
      return new Response(bytes, { status: 200, headers: { ...base, "content-type": "application/xml;charset=utf-8" } });
    }
    if (variant === "11") {
      return new Response(bytes, { status: 200, headers: { ...base, "content-type": "application/xml; charset=UTF-8 " } });
    }
    if (variant === "12") {
      return new Response(bytes, { status: 200, headers: { ...base, "content-type": "application/sitemap+xml; charset=utf-8" } });
    }
    if (variant === "5") {
      return new Response("hello world", { status: 200, headers: { ...base, "content-type": "application/xml; charset=utf-8" } });
    }
    if (variant === "6") {
      return new Response("\uFEFF" + xml, { status: 200, headers: { ...base, "content-type": "application/xml; charset=utf-8" } });
    }
    if (variant === "7") {
      return new Response(bytes, { status: 200, headers: { ...base, "content-type": "application/rss+xml; charset=utf-8" } });
    }
    if (variant === "8") {
      return new Response(bytes, { status: 200, headers: { ...base, "content-type": "application/xml; charset=utf-8", "content-disposition": "attachment; filename=\"sitemap.xml\"" } });
    }
    if (variant === "4") {
      return new Response(bytes, { status: 200, headers: { ...base, "content-type": "application/xml", "content-length": String(bytes.byteLength) } });
    }
    return new Response(xml, { status: 200, headers: xmlHeaders() });
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
