import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildSitemapEntries, STATIC_PAGES, BASE_URL } from "../../supabase/functions/sitemap/build-sitemap";
import { SCANS } from "../../supabase/functions/media-guard/rules";

const MIGRATION = readFileSync("supabase/migrations/20260817155012_gallery_items.sql", "utf8");

describe("sitemap rollout safety", () => {
  it("never lists the gallery as an always-on static page", () => {
    expect(STATIC_PAGES.map((p) => p.id)).not.toContain("gallery");
  });

  it("emits nothing for the gallery when the table is missing or empty", () => {
    const locs = buildSitemapEntries([], [], new Date(), { includeGallery: false }).map((e) => e.loc);
    expect(locs.filter((l) => /galeria|gallery|galereya/.test(l))).toHaveLength(0);
  });

  it("emits all three URLs with alternates once an item is published", () => {
    const entries = buildSitemapEntries([], [], new Date(), { includeGallery: true });
    const gallery = entries.filter((e) => /galeria|gallery|galereya/.test(e.loc));
    expect(gallery.map((e) => e.loc).sort()).toEqual(
      [`${BASE_URL}/en/gallery`, `${BASE_URL}/galeria`, `${BASE_URL}/ru/galereya`].sort(),
    );
    for (const e of gallery) {
      const langs = (e.alternates ?? []).map((a) => a.hreflang).sort();
      expect(langs).toEqual(["en", "es", "ru", "x-default"]);
    }
    // Exactly one entry per locale — the gate must not duplicate a static entry.
    expect(new Set(gallery.map((e) => e.loc)).size).toBe(3);
  });
});

describe("media guard covers gallery media", () => {
  const rule = SCANS.find((r) => r.table === "gallery_items");

  it("scans both the media and the poster of a gallery item", () => {
    expect(rule).toBeTruthy();
    expect(rule!.fields).toContain("media_url");
    expect(rule!.fields).toContain("poster_url");
    expect(rule!.optional).toBe(true);
  });

  it("keeps scanning localized carousel alt text", () => {
    const images = SCANS.find((r) => r.table === "page_images")!;
    expect(images.fields).toEqual(expect.arrayContaining(["image_url", "alt_text", "alt_text_en", "alt_text_ru"]));
  });
});

/** Only the body of swap_gallery_order, up to its own closing $function$. */
const swapBody = (() => {
  const start = MIGRATION.indexOf("CREATE OR REPLACE FUNCTION public.swap_gallery_order");
  const bodyStart = MIGRATION.indexOf("$function$", start) + "$function$".length;
  const bodyEnd = MIGRATION.indexOf("$function$", bodyStart);
  return MIGRATION.slice(bodyStart, bodyEnd);
})();

describe("pending gallery migration", () => {
  it("defaults items to unpublished and constrains the media type", () => {
    expect(MIGRATION).toMatch(/published\s+boolean\s+not null\s+default\s+false/i);
    expect(MIGRATION).toMatch(/check\s*\(\s*media_type\s+in\s*\(\s*'photo'\s*,\s*'video'\s*\)\s*\)/i);
  });

  it("rejects blank media, negative durations and published videos without a cover", () => {
    expect(MIGRATION).toMatch(/gallery_items_media_url_not_blank check \(length\(btrim\(media_url\)\) > 0\)/i);
    expect(MIGRATION).toMatch(/duration_seconds is null or duration_seconds >= 0/i);
    expect(MIGRATION).toMatch(
      /media_type <> 'video' or published = false or length\(btrim\(poster_url\)\) > 0/i,
    );
  });

  it("exposes only published items to anonymous readers", () => {
    expect(MIGRATION).toMatch(/enable row level security/i);
    expect(MIGRATION).toMatch(/using\s*\(\s*published\s*=\s*true\s*\)/i);
    expect(MIGRATION).toMatch(/grant select on public\.gallery_items to anon/i);
    expect(MIGRATION).toMatch(/has_role\(auth\.uid\(\),\s*'admin'::app_role\)/i);
    // anon gets read-only access; writes stay with authenticated admins / service_role.
    expect(MIGRATION).not.toMatch(/grant[^;]*(insert|update|delete)[^;]*to anon/i);
  });

  it("locks both rows in a single deterministic statement when reordering", () => {
    expect(swapBody).toMatch(
      /perform id from public\.gallery_items\s+where id in \(_a, _b\)\s+order by id\s+for update;/i,
    );
    expect(swapBody).toMatch(/get diagnostics\s+locked_count\s*=\s*row_count;/i);
    expect(swapBody).toMatch(/locked_count <> 2/i);
    // No caller-ordered per-row locking left behind.
    expect(swapBody).not.toMatch(/where id = _a[\s\S]{0,60}for update/i);
  });

  it("restricts the reorder RPC to admins or the service role and revokes anon", () => {
    expect(swapBody).toMatch(/jwt_role = 'service_role'/);
    expect(swapBody).toMatch(/has_role\(auth\.uid\(\), 'admin'::app_role\)/);
    expect(MIGRATION).toMatch(/revoke all on function public\.swap_gallery_order[\s\S]{0,80}from public/i);
    expect(MIGRATION).not.toMatch(/grant execute on function public\.swap_gallery_order[^;]*to anon/i);
  });

  it("keeps every media reference column in rewrite_media_references", () => {
    const rpc = MIGRATION.slice(MIGRATION.indexOf("rewrite_media_references"));
    for (const col of ["alt_text", "alt_text_en", "alt_text_ru", "media_url", "poster_url"]) {
      expect(rpc).toContain(col);
    }
  });
});


describe("bundle shape", () => {
  const app = readFileSync("src/App.tsx", "utf8");
  const dash = readFileSync("src/components/dashboard/DashboardGallery.tsx", "utf8");
  const poster = readFileSync("src/lib/gallery-poster.ts", "utf8");

  it("loads the public gallery route lazily", () => {
    expect(app).toMatch(/lazy\(\(\) => import\("(\.\/pages\/Galeria|@\/pages\/Galeria)"\)\)/);
    expect(app).not.toMatch(/^import Galeria/m);
  });

  it("only reaches the poster module through a dynamic import after an admin action", () => {
    expect(dash).not.toMatch(/^import .*gallery-poster/m);
    expect(dash).toMatch(/await import\("@\/lib\/gallery-poster"\)/);
  });

  it("keeps ffmpeg out of the poster module's static import graph", () => {
    expect(poster).not.toMatch(/^import .*@ffmpeg/m);
    expect(poster).not.toMatch(/^import .*video-ffmpeg/m);
    expect(poster).toMatch(/await import\("@\/lib\/video-ffmpeg"\)/);
  });
});
