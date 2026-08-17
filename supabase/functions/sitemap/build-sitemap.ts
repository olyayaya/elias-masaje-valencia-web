// Pure sitemap builder shared by the edge function and the test-suite.
// No Deno / Supabase imports here so it can run under vitest.

export const BASE_URL = "https://eliasmas.es";

export const LOCALES = ["es", "en", "ru"] as const;
export type Locale = (typeof LOCALES)[number];

/** Canonical static routes — mirrors src/config/routes.ts */
export const ROUTE_MAP = {
  home: { es: "/", en: "/en", ru: "/ru" },
  services: { es: "/servicios", en: "/en/services", ru: "/ru/uslugi" },
  gallery: { es: "/galeria", en: "/en/gallery", ru: "/ru/galereya" },
  about: { es: "/sobre-mi", en: "/en/about", ru: "/ru/about" },
  contact: { es: "/contacto", en: "/en/contact", ru: "/ru/contact" },
  blog: { es: "/blog", en: "/en/blog", ru: "/ru/blog" },
  privacy: { es: "/privacidad", en: "/en/privacy", ru: "/ru/privacy" },
} as const satisfies Record<string, Record<Locale, string>>;

export type PageId = keyof typeof ROUTE_MAP;

export const STATIC_PAGES: Array<{ id: PageId; changefreq: string; priority: string }> = [
  { id: "home", changefreq: "weekly", priority: "1.0" },
  { id: "services", changefreq: "weekly", priority: "0.9" },
  { id: "gallery", changefreq: "weekly", priority: "0.8" },
  { id: "about", changefreq: "monthly", priority: "0.7" },
  { id: "contact", changefreq: "monthly", priority: "0.7" },
  { id: "blog", changefreq: "daily", priority: "0.8" },
  { id: "privacy", changefreq: "yearly", priority: "0.3" },
];

export interface BlogPostRow {
  slug: string | null;
  slug_es?: string | null;
  slug_en?: string | null;
  slug_ru?: string | null;
  updated_at?: string | null;
  published_at?: string | null;
  status?: string | null;
  hidden?: boolean | null;
}

export interface ExtraUrl {
  loc: string;
  changefreq?: string;
  priority?: string;
  lastmod?: string;
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toW3CDate(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

/**
 * Defensive filter — the DB query already scopes these, but scheduled posts
 * and empty slugs must never leak into the sitemap.
 */
export function isIndexablePost(post: BlogPostRow, now: Date = new Date()): boolean {
  if (!post.slug || !post.slug.trim()) return false;
  if (post.status !== "published") return false;
  if (post.hidden !== false) return false;
  if (!post.published_at) return false;
  const published = new Date(post.published_at);
  if (Number.isNaN(published.getTime())) return false;
  if (published.getTime() > now.getTime()) return false;
  return true;
}

/**
 * Localized slug for a locale, falling back to the untouched legacy slug so
 * rows whose localized columns are still null stay indexable during rollout.
 */
export function slugForLocale(post: BlogPostRow, locale: Locale): string {
  const localized = locale === "es" ? post.slug_es : locale === "en" ? post.slug_en : post.slug_ru;
  return (localized ?? "").trim() || (post.slug ?? "").trim();
}

interface UrlEntry {
  loc: string;
  alternates: { hreflang: string; href: string }[];
  changefreq: string;
  priority: string;
  lastmod?: string;
}

function renderUrl(entry: UrlEntry): string {
  const alts = entry.alternates
    .map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${escapeXml(a.href)}"/>`)
    .join("\n");
  return [
    `  <url>`,
    `    <loc>${escapeXml(entry.loc)}</loc>`,
    alts || null,
    entry.lastmod ? `    <lastmod>${entry.lastmod}</lastmod>` : null,
    `    <changefreq>${entry.changefreq}</changefreq>`,
    `    <priority>${entry.priority}</priority>`,
    `  </url>`,
  ]
    .filter((l) => l !== null && l !== "")
    .join("\n");
}

function alternatesFor(pathFor: (loc: Locale) => string) {
  return [
    ...LOCALES.map((loc) => ({ hreflang: loc, href: `${BASE_URL}${pathFor(loc)}` })),
    { hreflang: "x-default", href: `${BASE_URL}${pathFor("es")}` },
  ];
}

export function buildSitemapEntries(
  posts: BlogPostRow[],
  extraUrls: ExtraUrl[] = [],
  now: Date = new Date(),
): UrlEntry[] {
  const entries: UrlEntry[] = [];

  for (const page of STATIC_PAGES) {
    const paths = ROUTE_MAP[page.id];
    const alternates = alternatesFor((loc) => paths[loc]);
    for (const locale of LOCALES) {
      entries.push({
        loc: `${BASE_URL}${paths[locale]}`,
        alternates,
        changefreq: page.changefreq,
        priority: page.priority,
      });
    }
  }

  for (const post of posts) {
    if (!isIndexablePost(post, now)) continue;
    const lastmod = toW3CDate(post.updated_at) ?? toW3CDate(post.published_at);
    const alternates = alternatesFor((loc) => `${ROUTE_MAP.blog[loc]}/${slugForLocale(post, loc)}`);
    for (const locale of LOCALES) {
      entries.push({
        loc: `${BASE_URL}${ROUTE_MAP.blog[locale]}/${slugForLocale(post, locale)}`,
        alternates,
        changefreq: "monthly",
        priority: "0.6",
        lastmod,
      });
    }
  }

  for (const u of extraUrls) {
    entries.push({
      loc: u.loc,
      alternates: [],
      changefreq: u.changefreq || "monthly",
      priority: u.priority || "0.5",
      lastmod: u.lastmod,
    });
  }

  // De-duplicate by <loc>, keeping the first occurrence.
  const seen = new Set<string>();
  return entries.filter((e) => (seen.has(e.loc) ? false : (seen.add(e.loc), true)));
}

export function buildSitemapXml(
  posts: BlogPostRow[],
  extraUrls: ExtraUrl[] = [],
  now: Date = new Date(),
): string {
  const urls = buildSitemapEntries(posts, extraUrls, now).map(renderUrl);
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}
