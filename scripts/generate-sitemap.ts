// Runs before `vite dev` and `vite build` (predev/prebuild hooks); writes public/sitemap.xml.

import { writeFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = "https://eliasmas.es";

const LOCALES = ["es", "en", "ru"] as const;
type Locale = (typeof LOCALES)[number];

const ROUTE_MAP: Record<string, Record<Locale, string>> = {
  home: { es: "/", en: "/en", ru: "/ru" },
  services: { es: "/servicios", en: "/en/services", ru: "/ru/uslugi" },
  about: { es: "/sobre-mi", en: "/en/about", ru: "/ru/about" },
  contact: { es: "/contacto", en: "/en/contact", ru: "/ru/contact" },
  blog: { es: "/blog", en: "/en/blog", ru: "/ru/blog" },
  privacy: { es: "/privacidad", en: "/en/privacy", ru: "/ru/privacy" },
};

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
  alternates?: { hreflang: string; href: string }[];
}

function staticAlternates(pageId: string) {
  return [
    ...LOCALES.map((loc) => ({ hreflang: loc, href: `${BASE_URL}${ROUTE_MAP[pageId][loc]}` })),
    { hreflang: "x-default", href: `${BASE_URL}${ROUTE_MAP[pageId].es}` },
  ];
}

const PRIORITY: Record<string, string> = {
  home: "1.0",
  services: "0.9",
  contact: "0.8",
  about: "0.7",
  blog: "0.7",
  privacy: "0.3",
};

function buildStaticEntries(blogLastmod?: string): SitemapEntry[] {
  return Object.keys(ROUTE_MAP).flatMap((pageId) =>
    LOCALES.map((loc) => ({
      path: ROUTE_MAP[pageId][loc],
      // Only the blog index has an authoritative, page-specific timestamp
      // (the newest published post). Other pages get no <lastmod> rather
      // than a misleading build-time date.
      lastmod: pageId === "blog" ? blogLastmod : undefined,
      changefreq: pageId === "blog" ? ("weekly" as const) : ("monthly" as const),
      priority: PRIORITY[pageId],
      alternates: staticAlternates(pageId),
    })),
  );
}

async function fetchBlogEntries(): Promise<SitemapEntry[]> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.warn("sitemap: no backend credentials, skipping blog posts");
    return [];
  }

  const query =
    `${url}/rest/v1/blog_posts?select=slug,id,updated_at,published_at` +
    `&status=eq.published&hidden=is.false&published_at=lte.${encodeURIComponent(new Date().toISOString())}` +
    `&order=published_at.desc`;

  try {
    const res = await fetch(query, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = (await res.json()) as {
      slug: string | null;
      id: string;
      updated_at: string | null;
      published_at: string | null;
    }[];

    return rows.flatMap((row) => {
      const slug = row.slug || row.id;
      const stamp = row.updated_at || row.published_at;
      const alternates = [
        ...LOCALES.map((loc) => ({ hreflang: loc, href: `${BASE_URL}${ROUTE_MAP.blog[loc]}/${slug}` })),
        { hreflang: "x-default", href: `${BASE_URL}${ROUTE_MAP.blog.es}/${slug}` },
      ];
      return LOCALES.map((loc) => ({
        path: `${ROUTE_MAP.blog[loc]}/${slug}`,
        lastmod: toW3CDate(stamp),
        changefreq: "monthly" as const,
        priority: "0.6",
        alternates,
      }));
    });
  } catch (err) {
    console.warn("sitemap: could not load blog posts —", (err as Error).message);
    return [];
  }
}

function toW3CDate(value: string | null | undefined) {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().replace(/\.\d{3}Z$/, "+00:00");
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function generateSitemap(entries: SitemapEntry[]) {
  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${escapeXml(BASE_URL + e.path)}</loc>`,
      ...(e.alternates ?? []).map(
        (a) =>
          `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${escapeXml(a.href)}" />`,
      ),
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

const blogEntries = await fetchBlogEntries();
const newestBlogLastmod = blogEntries
  .map((e) => e.lastmod)
  .filter((v): v is string => Boolean(v))
  .sort()
  .pop();
const entries = [...buildStaticEntries(newestBlogLastmod), ...blogEntries];
writeFileSync(resolve("public/sitemap.xml"), generateSitemap(entries));
console.log(`sitemap.xml written (${entries.length} entries)`);
