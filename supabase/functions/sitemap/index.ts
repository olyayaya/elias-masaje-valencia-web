import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildSitemapXml, type ExtraUrl } from "./build-sitemap.ts";

import { xmlResponse, errorXml } from "./xml-response.ts";

// The function is the single source of truth for the sitemap and always serves
// an XML media type with UTF-8 bytes (see xml-response.ts for the header notes).



Deno.serve(async (_req) => {
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

    return xmlResponse(xml, 200, "public, max-age=60, s-maxage=60");
  } catch (err) {
    console.error("Sitemap error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return xmlResponse(errorXml(message), 500, "no-store");
  }
});
