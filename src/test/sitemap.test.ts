import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import {
  buildSitemapXml,
  buildSitemapEntries,
  BASE_URL,
  type BlogPostRow,
} from "../../supabase/functions/sitemap/build-sitemap";
import worker, { UPSTREAM, PROXIED_PATH } from "../../infrastructure/cloudflare/sitemap-proxy/worker.js";

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

describe("cloudflare sitemap worker", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("proxies /sitemap.xml to the edge function and preserves status/content-type", async () => {
    const fetchMock = vi.fn(async (_input: unknown) =>
      new Response("<?xml version=\"1.0\"?><urlset/>", {
        status: 200,
        headers: { "Content-Type": "application/xml; charset=utf-8" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await worker.fetch(new Request("https://eliasmas.es/sitemap.xml"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(UPSTREAM);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/xml; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=60, s-maxage=60");
  });

  it("does not intercept other paths", async () => {
    const fetchMock = vi.fn(async (_input: unknown) => new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);

    await worker.fetch(new Request("https://eliasmas.es/servicios"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).not.toBe(UPSTREAM);
  });

  it("contains no URL list of its own", () => {
    const src = readFileSync(
      resolve(__dirname, "../../infrastructure/cloudflare/sitemap-proxy/worker.js"),
      "utf8",
    );
    expect(PROXIED_PATH).toBe("/sitemap.xml");
    expect(src).not.toContain("eliasmas.es/servicios");
    expect(src.match(/https:\/\/[^\s"']+/g) ?? []).toEqual([UPSTREAM]);
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

  it("robots.txt declares exactly one canonical sitemap", () => {
    const robots = readFileSync(resolve(__dirname, "../../public/robots.txt"), "utf8");
    const lines = robots.split("\n").filter((l) => l.trim().toLowerCase().startsWith("sitemap:"));
    expect(lines.map((l) => l.trim())).toEqual(["Sitemap: https://eliasmas.es/sitemap.xml"]);
  });
});
