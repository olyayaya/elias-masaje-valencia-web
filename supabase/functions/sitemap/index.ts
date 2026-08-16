import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const BASE_URL = "https://eliasmas.es";

const ROUTE_MAP = {
  home:     { es: "/",          en: "/en",          ru: "/ru" },
  services: { es: "/servicios", en: "/en/services", ru: "/ru/uslugi" },
  about:    { es: "/sobre-mi",  en: "/en/about",    ru: "/ru/about" },
  contact:  { es: "/contacto",  en: "/en/contact",  ru: "/ru/contact" },
  blog:     { es: "/blog",      en: "/en/blog",     ru: "/ru/blog" },
} as const;

const STATIC_PAGES: Array<{
  id: keyof typeof ROUTE_MAP;
  changefreq: string;
  priority: string;
}> = [
  { id: "home",     changefreq: "weekly",  priority: "1.0" },
  { id: "services", changefreq: "weekly",  priority: "0.9" },
  { id: "about",    changefreq: "monthly", priority: "0.7" },
  { id: "contact",  changefreq: "monthly", priority: "0.7" },
  { id: "blog",     changefreq: "daily",   priority: "0.8" },
];

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry(opts: {
  loc: string;
  alternates: { hreflang: string; href: string }[];
  changefreq: string;
  priority: string;
  lastmod?: string;
}): string {
  const alts = opts.alternates
    .map(
      (a) =>
        `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${escapeXml(a.href)}"/>`
    )
    .join("\n");
  const lastmod = opts.lastmod ? `\n    <lastmod>${opts.lastmod}</lastmod>` : "";
  return `  <url>
    <loc>${escapeXml(opts.loc)}</loc>
${alts}${lastmod}
    <changefreq>${opts.changefreq}</changefreq>
    <priority>${opts.priority}</priority>
  </url>`;
}

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: posts, error } = await supabase
      .from("blog_posts")
      .select("slug, updated_at")
      .eq("status", "published")
      .eq("hidden", false)
      .not("slug", "is", null)
      .order("published_at", { ascending: false, nullsFirst: false });

    if (error) throw error;

    // Load extra URLs configured from the dashboard (sitemap_config JSON blob in site_content)
    type ExtraUrl = { loc: string; changefreq?: string; priority?: string; lastmod?: string };
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
            (u: any) => u && typeof u.loc === "string" && u.loc.startsWith("http")
          );
        }
      }
    } catch (e) {
      console.warn("sitemap_config parse failed, ignoring:", e);
    }

    const entries: string[] = [];

    // Static pages — one entry per locale, with hreflang alternates
    for (const page of STATIC_PAGES) {
      const paths = ROUTE_MAP[page.id];
      const alternates = [
        { hreflang: "es", href: `${BASE_URL}${paths.es}` },
        { hreflang: "en", href: `${BASE_URL}${paths.en}` },
        { hreflang: "ru", href: `${BASE_URL}${paths.ru}` },
        { hreflang: "x-default", href: `${BASE_URL}${paths.es}` },
      ];
      for (const locale of ["es", "en", "ru"] as const) {
        entries.push(
          urlEntry({
            loc: `${BASE_URL}${paths[locale]}`,
            alternates,
            changefreq: page.changefreq,
            priority: page.priority,
          })
        );
      }
    }

    // Blog posts
    for (const post of posts ?? []) {
      if (!post.slug) continue;
      const lastmod = post.updated_at
        ? new Date(post.updated_at).toISOString().slice(0, 10)
        : undefined;
      const alternates = [
        { hreflang: "es", href: `${BASE_URL}/blog/${post.slug}` },
        { hreflang: "en", href: `${BASE_URL}/en/blog/${post.slug}` },
        { hreflang: "ru", href: `${BASE_URL}/ru/blog/${post.slug}` },
        { hreflang: "x-default", href: `${BASE_URL}/blog/${post.slug}` },
      ];
      for (const prefix of ["", "/en", "/ru"]) {
        entries.push(
          urlEntry({
            loc: `${BASE_URL}${prefix}/blog/${post.slug}`,
            alternates,
            changefreq: "monthly",
            priority: "0.6",
            lastmod,
          })
        );
      }
    }

    // Dashboard-managed extra URLs (no hreflang alternates, single locale)
    for (const u of extraUrls) {
      entries.push(
        urlEntry({
          loc: u.loc,
          alternates: [],
          changefreq: u.changefreq || "monthly",
          priority: u.priority || "0.5",
          lastmod: u.lastmod,
        })
      );
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join("\n")}
</urlset>`;

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=60, s-maxage=60",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("Sitemap error:", err);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><error>${String(err)}</error>`,
      {
        status: 500,
        headers: { "Content-Type": "application/xml; charset=utf-8" },
      }
    );
  }
});
