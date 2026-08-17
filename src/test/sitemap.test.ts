import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import {
  buildSitemapXml,
  buildSitemapEntries,
  BASE_URL,
  ROUTE_MAP as BUILDER_ROUTE_MAP,
  type BlogPostRow,
} from "../../supabase/functions/sitemap/build-sitemap";
import {
  XML_CONTENT_TYPE,
  xmlResponseHeaders,
  errorXml,
} from "../../supabase/functions/sitemap/xml-response";
import * as APP_ROUTES from "@/config/routes";

const NOW = new Date("2026-08-16T12:00:00.000Z");

const POSTS: BlogPostRow[] = [
  {
    slug: "sportivnyy-massazh-dlya-begunov-valensiya",
    slug_es: "beneficios-masaje-deportivo-corredores-valencia",
    slug_en: "sports-massage-benefits-runners-active-men-valencia",
    slug_ru: "sportivnyy-massazh-dlya-begunov-valensiya",
    status: "published", hidden: false, published_at: "2026-05-01T10:00:00Z", updated_at: "2026-06-01T10:00:00Z",
  },
  {
    slug: "antistress-massazh-dlya-muzhchin-valensiya",
    slug_es: "masaje-antiestres-hombres-valencia",
    slug_en: "anti-stress-massage-men-valencia",
    slug_ru: "antistress-massazh-dlya-muzhchin-valensiya",
    status: "published", hidden: false, published_at: "2026-04-01T10:00:00Z", updated_at: null,
  },
  {
    slug: "5-beneficios-masaje-espalda-oficinistas",
    slug_es: "5-beneficios-masaje-espalda-oficinistas",
    slug_en: "5-benefits-back-massage-office-workers",
    slug_ru: "5-preimushchestv-massazha-spiny-dlya-ofisnykh-rabotnikov",
    status: "published", hidden: false, published_at: "2026-03-01T10:00:00Z", updated_at: "2026-03-05T10:00:00Z",
  },
  {
    slug: "beneficios-masaje-regular",
    slug_es: "beneficios-masaje-regular",
    slug_en: "benefits-of-regular-massage",
    slug_ru: "polza-regulyarnogo-massazha",
    status: "published", hidden: false, published_at: "2026-02-01T10:00:00Z", updated_at: "2026-02-02T10:00:00Z",
  },
  // excluded
  { slug: "borrador", status: "draft", hidden: false, published_at: "2026-01-01T10:00:00Z" },
  { slug: "oculto", status: "published", hidden: true, published_at: "2026-01-01T10:00:00Z" },
  { slug: "  ", status: "published", hidden: false, published_at: "2026-01-01T10:00:00Z" },
  { slug: null, status: "published", hidden: false, published_at: "2026-01-01T10:00:00Z" },
  { slug: "programado", status: "published", hidden: false, published_at: "2027-01-01T10:00:00Z" },
];

const MAPPINGS: Array<[string, string, string]> = [
  [
    "beneficios-masaje-deportivo-corredores-valencia",
    "sports-massage-benefits-runners-active-men-valencia",
    "sportivnyy-massazh-dlya-begunov-valensiya",
  ],
  [
    "masaje-antiestres-hombres-valencia",
    "anti-stress-massage-men-valencia",
    "antistress-massazh-dlya-muzhchin-valensiya",
  ],
  [
    "5-beneficios-masaje-espalda-oficinistas",
    "5-benefits-back-massage-office-workers",
    "5-preimushchestv-massazha-spiny-dlya-ofisnykh-rabotnikov",
  ],
  ["beneficios-masaje-regular", "benefits-of-regular-massage", "polza-regulyarnogo-massazha"],
];

const locs = () => buildSitemapEntries(POSTS, [], NOW).map((e) => e.loc);

describe("sitemap generator", () => {
  it("emits 12 article URLs for 4 published posts", () => {
    const blogPostUrls = locs().filter((l) => /\/blog\/[^/]+$/.test(l));
    expect(blogPostUrls).toHaveLength(12);
  });

  it("emits the exact localized ES/EN/RU URLs for every mapping", () => {
    const all = locs();
    for (const [es, en, ru] of MAPPINGS) {
      expect(all).toContain(`${BASE_URL}/blog/${es}`);
      expect(all).toContain(`${BASE_URL}/en/blog/${en}`);
      expect(all).toContain(`${BASE_URL}/ru/blog/${ru}`);
    }
  });

  it("omits the gallery URLs until at least one item is published", () => {
    const all = locs();
    expect(all).toHaveLength(30);
    expect(new Set(all).size).toBe(30);
    expect(all).not.toContain(`${BASE_URL}/galeria`);
    expect(all).not.toContain(`${BASE_URL}/en/gallery`);
    expect(all).not.toContain(`${BASE_URL}/ru/galereya`);
  });

  it("emits the gallery URLs once the section has published content", () => {
    const all = buildSitemapEntries(POSTS, [], NOW, { includeGallery: true }).map((e) => e.loc);
    expect(all).toHaveLength(33);
    expect(all).toContain(`${BASE_URL}/galeria`);
    expect(all).toContain(`${BASE_URL}/en/gallery`);
    expect(all).toContain(`${BASE_URL}/ru/galereya`);
  });


  it("emits reciprocal article hreflang with Spanish x-default", () => {
    const entries = buildSitemapEntries(POSTS, [], NOW);
    const en = entries.find(
      (e) => e.loc === `${BASE_URL}/en/blog/sports-massage-benefits-runners-active-men-valencia`,
    )!;
    expect(en.alternates).toEqual([
      { hreflang: "es", href: `${BASE_URL}/blog/beneficios-masaje-deportivo-corredores-valencia` },
      { hreflang: "en", href: `${BASE_URL}/en/blog/sports-massage-benefits-runners-active-men-valencia` },
      { hreflang: "ru", href: `${BASE_URL}/ru/blog/sportivnyy-massazh-dlya-begunov-valensiya` },
      { hreflang: "x-default", href: `${BASE_URL}/blog/beneficios-masaje-deportivo-corredores-valencia` },
    ]);
  });

  it("falls back to the legacy slug when localized columns are null", () => {
    const rows: BlogPostRow[] = [
      { slug: "legacy-only", slug_es: null, slug_en: null, slug_ru: null, status: "published", hidden: false, published_at: "2026-01-01T00:00:00Z" },
      { slug: "partial", slug_es: "solo-espanol", slug_en: null, slug_ru: null, status: "published", hidden: false, published_at: "2026-01-01T00:00:00Z" },
    ];
    const all = buildSitemapEntries(rows, [], NOW).map((e) => e.loc);
    expect(all).toContain(`${BASE_URL}/blog/legacy-only`);
    expect(all).toContain(`${BASE_URL}/en/blog/legacy-only`);
    expect(all).toContain(`${BASE_URL}/ru/blog/legacy-only`);
    expect(all).toContain(`${BASE_URL}/blog/solo-espanol`);
    expect(all).toContain(`${BASE_URL}/en/blog/partial`);
    expect(all).toContain(`${BASE_URL}/ru/blog/partial`);
  });

  it("excludes draft, hidden, empty-slug and future scheduled posts", () => {
    const all = locs().join("\n");
    for (const slug of ["borrador", "oculto", "programado"]) {
      expect(all).not.toContain(slug);
    }
    expect(all).not.toMatch(/\/blog\/\s*$/m);
  });

  it("excludes posts with null or invalid published_at", () => {
    const rows: BlogPostRow[] = [
      { slug: "sin-fecha", status: "published", hidden: false, published_at: null },
      { slug: "fecha-invalida", status: "published", hidden: false, published_at: "not-a-date" },
      { slug: "sin-hidden", status: "published", published_at: "2026-01-01T00:00:00Z" },
    ];
    const all = buildSitemapEntries(rows, [], NOW).map((e) => e.loc).join("\n");
    for (const slug of ["sin-fecha", "fecha-invalida", "sin-hidden"]) {
      expect(all).not.toContain(slug);
    }
  });

  it("includes the privacy page for ES/EN/RU", () => {
    const all = locs();
    for (const path of ["/privacidad", "/en/privacy", "/ru/privacy"]) {
      expect(all).toContain(`${BASE_URL}${path}`);
    }
  });

  it("produces unique URLs", () => {
    const all = locs();
    expect(new Set(all).size).toBe(all.length);
  });

  it("emits mutual hreflang alternates including x-default", () => {
    const entries = buildSitemapEntries(POSTS, [], NOW);
    const es = entries.find((e) => e.loc === `${BASE_URL}/servicios`)!;
    const ru = entries.find((e) => e.loc === `${BASE_URL}/ru/uslugi`)!;
    for (const entry of [es, ru]) {
      expect(entry.alternates.map((a) => a.hreflang).sort()).toEqual(["en", "es", "ru", "x-default"]);
      expect(entry.alternates.find((a) => a.hreflang === "x-default")!.href).toBe(`${BASE_URL}/servicios`);
    }
  });

  it("uses updated_at with fallback to published_at for lastmod", () => {
    const entries = buildSitemapEntries(POSTS, [], NOW);
    const withUpdated = entries.find((e) => e.loc.endsWith("/blog/5-beneficios-masaje-espalda-oficinistas"))!;
    const withoutUpdated = entries.find((e) => e.loc.endsWith("/blog/masaje-antiestres-hombres-valencia"))!;
    expect(withUpdated.lastmod).toBe("2026-03-05");
    expect(withoutUpdated.lastmod).toBe("2026-04-01");
  });

  it("renders well-formed, escaped XML", () => {
    const xml = buildSitemapXml(
      [{ slug: "a&b", status: "published", hidden: false, published_at: "2026-01-01T00:00:00Z" }],
      [],
      NOW,
    );
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml.trim().endsWith("</urlset>")).toBe(true);
    expect(xml).toContain("/blog/a&amp;b");
    expect(xml).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
    expect(doc.getElementsByTagName("url").length).toBeGreaterThan(0);
  });
});

describe("route map mirror", () => {
  it("matches the static routes in src/config/routes.ts", () => {
    const { ROUTE_MAP: appRoutes } = APP_ROUTES;
    const expected = Object.fromEntries(
      Object.entries(appRoutes).filter(([id]) => id !== "blogPost"),
    );
    expect(BUILDER_ROUTE_MAP).toEqual(expected);
  });
});

describe("single sitemap mechanism", () => {
  it("has no static generator or static sitemap file", () => {
    expect(existsSync(resolve(__dirname, "../../scripts/generate-sitemap.ts"))).toBe(false);
    expect(existsSync(resolve(__dirname, "../../public/sitemap.xml"))).toBe(false);
  });

  it("has no predev/prebuild sitemap hooks", () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, "../../package.json"), "utf8"));
    expect(pkg.scripts.predev).toBeUndefined();
    expect(pkg.scripts.prebuild).toBeUndefined();
    expect(JSON.stringify(pkg.scripts)).not.toContain("generate-sitemap");
  });

  it("robots.txt declares exactly one direct Supabase sitemap", () => {
    const robots = readFileSync(resolve(__dirname, "../../public/robots.txt"), "utf8");
    const lines = robots.split("\n").filter((l) => l.trim().toLowerCase().startsWith("sitemap:"));
    expect(lines.map((l) => l.trim())).toEqual([
      "Sitemap: https://ukjljyrejfkyurebksqz.supabase.co/functions/v1/sitemap",
    ]);
  });

  it("has no cloudflare sitemap proxy", () => {
    expect(existsSync(resolve(__dirname, "../../infrastructure/cloudflare"))).toBe(false);
  });
});

describe("sitemap edge function XML response path", () => {
  const source = readFileSync(
    resolve(__dirname, "../../supabase/functions/sitemap/index.ts"),
    "utf8",
  );

  it("declares an XML media type that survives the edge gateway", () => {
    // Case-insensitive per RFC 9110 §8.3; the exact casing must stay because the
    // gateway rewrites the all-lowercase spelling to text/plain on GET.
    expect(source).toContain('export const XML_CONTENT_TYPE = "application/XML; charset=utf-8";');
    expect(source).not.toMatch(/"application\/xml; charset=utf-8"/);
    expect(source).not.toMatch(/"text\/xml/);
    expect(XML_CONTENT_TYPE.toLowerCase()).toBe("application/xml; charset=utf-8");
  });

  it("sends UTF-8 bytes with a plain headers object", () => {
    expect(source).toContain("new TextEncoder().encode(xml)");
    expect(source).not.toContain("new Headers()");
    expect(xmlResponseHeaders("no-store")).toEqual({
      "content-type": XML_CONTENT_TYPE,
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "x-content-type-options": "nosniff",
    });
  });

  it("keeps cache-control, CORS and nosniff on the success path", () => {
    expect(source).toContain('xmlResponse(xml, 200, "public, max-age=60, s-maxage=60")');
    expect(xmlResponseHeaders("public, max-age=60, s-maxage=60")["cache-control"]).toBe(
      "public, max-age=60, s-maxage=60",
    );
  });

  it("serves the error path as escaped XML with the same content type", () => {
    expect(source).toContain('xmlResponse(errorXml(message), 500, "no-store")');
    const xml = errorXml('boom & <bad> "x"');
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain("boom &amp; &lt;bad&gt;");
    expect(xml).not.toMatch(/<(?!\/?error>|\?xml)/);
  });

  it("has no diagnostic content-type variants left behind", () => {
    expect(source).not.toContain("__ctv");
    expect(source).not.toContain("variant");
  });
});
