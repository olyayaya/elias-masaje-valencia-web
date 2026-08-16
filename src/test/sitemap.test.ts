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
import * as APP_ROUTES from "@/config/routes";

const NOW = new Date("2026-08-16T12:00:00.000Z");

const POSTS: BlogPostRow[] = [
  { slug: "sportivnyy-massazh-dlya-begunov-valensiya", status: "published", hidden: false, published_at: "2026-05-01T10:00:00Z", updated_at: "2026-06-01T10:00:00Z" },
  { slug: "masaje-descontracturante", status: "published", hidden: false, published_at: "2026-04-01T10:00:00Z", updated_at: null },
  { slug: "deep-tissue-valencia", status: "published", hidden: false, published_at: "2026-03-01T10:00:00Z", updated_at: "2026-03-05T10:00:00Z" },
  { slug: "masaje-relajante", status: "published", hidden: false, published_at: "2026-02-01T10:00:00Z", updated_at: "2026-02-02T10:00:00Z" },
  // excluded
  { slug: "borrador", status: "draft", hidden: false, published_at: "2026-01-01T10:00:00Z" },
  { slug: "oculto", status: "published", hidden: true, published_at: "2026-01-01T10:00:00Z" },
  { slug: "  ", status: "published", hidden: false, published_at: "2026-01-01T10:00:00Z" },
  { slug: null, status: "published", hidden: false, published_at: "2026-01-01T10:00:00Z" },
  { slug: "programado", status: "published", hidden: false, published_at: "2027-01-01T10:00:00Z" },
];

const locs = () => buildSitemapEntries(POSTS, [], NOW).map((e) => e.loc);

describe("sitemap generator", () => {
  it("emits 12 article URLs for 4 published posts", () => {
    const blogPostUrls = locs().filter((l) => /\/blog\/[^/]+$/.test(l));
    expect(blogPostUrls).toHaveLength(12);
  });

  it("includes the runners article in ES/EN/RU", () => {
    const all = locs();
    for (const path of ["/blog", "/en/blog", "/ru/blog"]) {
      expect(all).toContain(`${BASE_URL}${path}/sportivnyy-massazh-dlya-begunov-valensiya`);
    }
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
    const withUpdated = entries.find((e) => e.loc.endsWith("/blog/deep-tissue-valencia"))!;
    const withoutUpdated = entries.find((e) => e.loc.endsWith("/blog/masaje-descontracturante"))!;
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
