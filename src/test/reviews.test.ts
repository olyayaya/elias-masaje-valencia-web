import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import {
  DEFAULT_REVIEW_SETTINGS,
  parseReviewImport,
  publicReviews,
  sortReviews,
  type Review,
  type ReviewDisplaySettings,
} from "@/lib/reviews";

const review = (p: Partial<Review>): Review => ({
  id: p.id ?? "1",
  source: p.source ?? "google",
  external_review_id: p.external_review_id ?? "x",
  author_name: p.author_name ?? "Ana",
  author_avatar_url: null,
  rating: p.rating ?? 5,
  review_text: p.review_text ?? "text",
  review_language: null,
  reviewed_at: p.reviewed_at ?? "2026-01-01T00:00:00Z",
  original_url: p.original_url ?? null,
  visible: p.visible ?? true,
  pinned: p.pinned ?? false,
  manual_priority: p.manual_priority ?? 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  imported_at: null,
});

const settings = (p: Partial<ReviewDisplaySettings> = {}): ReviewDisplaySettings => ({
  id: "s",
  updated_at: "",
  ...DEFAULT_REVIEW_SETTINGS,
  ...p,
});

describe("review display rules", () => {
  it("defaults to 5★ only", () => {
    expect(DEFAULT_REVIEW_SETTINGS.allowed_ratings).toEqual([5]);
    expect(DEFAULT_REVIEW_SETTINGS.section_enabled).toBe(true);
  });

  it("hides 1–4★ until the toggle is switched on", () => {
    const list = [review({ id: "a", rating: 5 }), review({ id: "b", rating: 4 })];
    expect(publicReviews(list, settings()).map((r) => r.id)).toEqual(["a"]);
    expect(publicReviews(list, settings({ allowed_ratings: [4, 5] })).map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("hides hidden reviews and respects the section switch", () => {
    const list = [review({ id: "a" }), review({ id: "b", visible: false })];
    expect(publicReviews(list, settings()).map((r) => r.id)).toEqual(["a"]);
    expect(publicReviews(list, settings({ section_enabled: false }))).toHaveLength(0);
  });

  it("filters by allowed source", () => {
    const list = [review({ id: "a", source: "google" }), review({ id: "b", source: "manual" })];
    expect(publicReviews(list, settings({ allowed_sources: ["google"] })).map((r) => r.id)).toEqual(["a"]);
  });

  it("never shows a tripadvisor row, even if one somehow reaches the client", () => {
    // Not a supported source: no importer writes it and the DB CHECK forbids it.
    const rogue = { ...review({ id: "t" }), source: "tripadvisor" } as unknown as Review;
    expect(DEFAULT_REVIEW_SETTINGS.allowed_sources).toEqual(["google", "manual"]);
    expect(publicReviews([rogue], settings())).toEqual([]);
    expect(
      publicReviews([rogue], settings({ allowed_sources: ["google", "manual", "tripadvisor"] as never })),
    ).toEqual([]);
  });

  it("never invents cards when there is no data", () => {
    expect(publicReviews([], settings())).toEqual([]);
  });
});

describe("sortReviews", () => {
  const a = review({ id: "a", reviewed_at: "2026-01-01T00:00:00Z", rating: 3 });
  const b = review({ id: "b", reviewed_at: "2026-05-01T00:00:00Z", rating: 5 });
  const p = review({ id: "p", reviewed_at: "2020-01-01T00:00:00Z", rating: 1, pinned: true });

  it("keeps pinned reviews first in every mode", () => {
    for (const s of ["newest", "oldest", "rating_high", "rating_low", "manual"] as const) {
      expect(sortReviews([a, b, p], s)[0].id).toBe("p");
    }
  });

  it("orders by date and rating", () => {
    expect(sortReviews([a, b], "newest").map((r) => r.id)).toEqual(["b", "a"]);
    expect(sortReviews([a, b], "oldest").map((r) => r.id)).toEqual(["a", "b"]);
    expect(sortReviews([a, b], "rating_high").map((r) => r.id)).toEqual(["b", "a"]);
    expect(sortReviews([a, b], "rating_low").map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("tripadvisor import gating", () => {
  it("rejects a tripadvisor source with an explanatory error and imports nothing", () => {
    const { rows, errors } = parseReviewImport(
      "source,author_name,rating,review_text\ntripadvisor,Ana,5,Great\n",
    );
    expect(rows).toHaveLength(0);
    expect(errors[0]).toMatch(/TripAdvisor/);
    expect(errors[0]).toMatch(/manual/);
  });

  it("accepts the same text as a manual entry with an original_url", () => {
    const { rows, errors } = parseReviewImport(
      "source,author_name,rating,review_text,original_url\nmanual,Ana,5,Great,https://ok.example\n",
    );
    expect(errors).toEqual([]);
    expect(rows[0].source).toBe("manual");
    expect(rows[0].original_url).toBe("https://ok.example/");
  });
});

describe("parseReviewImport", () => {
  const csv =
    "source,external_review_id,author_name,rating,review_text,reviewed_at,original_url\n" +
    'google,g1,Ana,5,"Great, really",2026-02-01,https://maps.google.com/x\n' +
    "manual,m1,Bob,4,Nice,2026-03-01,https://example.com/y\n";

  it("parses a CSV export", () => {
    const { rows, errors } = parseReviewImport(csv);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0].review_text).toBe("Great, really");
    expect(rows[1].source).toBe("manual");
  });

  it("parses a JSON export", () => {
    const { rows } = parseReviewImport(
      JSON.stringify([{ source: "google", external_review_id: "g9", author_name: "Cy", rating: 5, review_text: "ok" }]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].external_review_id).toBe("g9");
  });

  it("rejects bad ratings, unknown sources and missing authors", () => {
    const { rows, errors } = parseReviewImport(
      "source,author_name,rating,review_text\nyelp,Ann,5,hi\ngoogle,Ann,9,hi\ngoogle,,5,hi\n",
    );
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(3);
  });

  it("drops non-https urls and in-file duplicates", () => {
    const { rows } = parseReviewImport(
      "source,external_review_id,author_name,rating,review_text,original_url\n" +
        "google,g1,Ana,5,hi,http://insecure.example\n" +
        "google,g1,Ana,5,hi,https://ok.example\n",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].original_url).toBeNull();
  });
});

describe("prepared backend artefacts", () => {
  const sql = readFileSync("supabase/pending-migrations/20260817170000_reviews.sql", "utf8");

  it("enforces rating bounds, dedupe key, RLS and grants", () => {
    expect(sql).toMatch(/rating\s+(smallint|integer)[^,]*check\s*\(\s*rating\s*(between|>=)/i);
    expect(sql).toMatch(/unique\s*\(\s*source\s*,\s*external_review_id\s*\)/i);
    expect(sql).toMatch(/enable row level security/i);
    expect(sql).toMatch(/grant/i);
  });

  it("ships no review sync edge function and no provider secrets", () => {
    expect(existsSync("supabase/functions/reviews-sync")).toBe(false);
    const tracked = execSync("git ls-files supabase src", { encoding: "utf8" });
    expect(tracked).not.toMatch(/reviews-sync/);
    expect(sql).not.toMatch(/review_sync_state/);
    expect(sql).not.toMatch(/GOOGLE_BUSINESS/);
  });
});

