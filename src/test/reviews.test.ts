import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import {
  CSV_TEMPLATE,
  DEFAULT_REVIEW_SETTINGS,
  MAX_IMPORT_ROWS,
  checkImportFileSize,
  chunk,
  dedupeKey,
  parseReviewImport,
  publicReviews,
  sortReviews,
  type Review,
  type ReviewDisplaySettings,
} from "@/lib/reviews";

const review = (p: Partial<Review>): Review => ({
  id: p.id ?? "1",
  dedupe_key: p.dedupe_key ?? "k",
  author_name: p.author_name ?? "Ana",
  rating: p.rating ?? 5,
  review_text: p.review_text ?? "text",
  original_language: p.original_language ?? null,
  review_text_es: p.review_text_es ?? null,
  review_text_en: p.review_text_en ?? null,
  review_text_ru: p.review_text_ru ?? null,
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

  it("drops incomplete rows instead of inventing an author or an empty card", () => {
    const list = [review({ id: "a" }), review({ id: "b", author_name: "  " }), review({ id: "c", review_text: "" })];
    expect(publicReviews(list, settings()).map((r) => r.id)).toEqual(["a"]);
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

describe("dedupeKey", () => {
  const base = { author_name: "Ana García", review_text: "Muy buen masaje", reviewed_at: "2026-02-01T00:00:00Z" };

  it("is deterministic and case/whitespace insensitive", () => {
    expect(dedupeKey(base)).toBe(dedupeKey(base));
    expect(dedupeKey({ ...base, author_name: "  ana   garcía " })).toBe(dedupeKey(base));
    expect(dedupeKey({ ...base, review_text: "Muy  buen\nmasaje" })).toBe(dedupeKey(base));
  });

  it("ignores the time of day but not the day", () => {
    expect(dedupeKey({ ...base, reviewed_at: "2026-02-01T23:59:00Z" })).toBe(dedupeKey(base));
    expect(dedupeKey({ ...base, reviewed_at: "2026-02-02T00:00:00Z" })).not.toBe(dedupeKey(base));
  });

  it("changes when the author or the text changes", () => {
    expect(dedupeKey({ ...base, author_name: "Bea" })).not.toBe(dedupeKey(base));
    expect(dedupeKey({ ...base, review_text: "Otra cosa" })).not.toBe(dedupeKey(base));
  });
});

describe("parseReviewImport", () => {
  const csv =
    "author_name,rating,review_text,reviewed_at,original_url\n" +
    'Ana,5,"Great, really",2026-02-01,https://maps.example/x\n' +
    "Bob,4,Nice,2026-03-01,https://example.com/y\n";

  it("parses a CSV file into a per-row preview", () => {
    const { rows, fileIssues, counts } = parseReviewImport(csv);
    expect(fileIssues).toEqual([]);
    expect(counts).toMatchObject({ total: 2, valid: 2, invalid: 0 });
    expect(rows[0].row?.review_text).toBe("Great, really");
    expect(rows[0].line).toBe(1);
    expect(rows[1].row?.original_url).toBe("https://example.com/y");
  });

  it("parses a JSON file and accepts common column aliases", () => {
    const { rows, counts } = parseReviewImport(
      JSON.stringify([{ name: "Cy", stars: "5", text: "ok", date: "2026-01-05" }]),
    );
    expect(counts.valid).toBe(1);
    expect(rows[0].row?.author_name).toBe("Cy");
    expect(rows[0].row?.rating).toBe(5);
  });

  it("flags bad rows individually instead of dropping the whole file", () => {
    const { rows, counts } = parseReviewImport(
      "author_name,rating,review_text,reviewed_at\n" +
        "Ann,9,hi,\n" + // rating out of range
        ",5,hi,\n" + // no author
        "Ann,5,,\n" + // no text
        "Ann,5,hi,not-a-date\n" +
        "Ann,5,ok,2026-01-01\n",
    );
    expect(counts).toMatchObject({ total: 5, valid: 1, invalid: 4 });
    expect(rows[0].issues[0].code).toBe("rating_invalid");
    expect(rows[1].issues[0].code).toBe("author_required");
    expect(rows[2].issues[0].code).toBe("text_required");
    expect(rows[3].issues[0].code).toBe("date_invalid");
    expect(rows[4].status).toBe("new");
  });

  it("rejects non-https links", () => {
    const { rows } = parseReviewImport(
      "author_name,rating,review_text,original_url\nAna,5,hi,http://insecure.example\n",
    );
    expect(rows[0].status).toBe("invalid");
    expect(rows[0].issues[0].code).toBe("url_invalid");
  });

  it("marks in-file duplicates and rows already stored", () => {
    const stored = dedupeKey({ author_name: "Ana", review_text: "hi", reviewed_at: "2026-01-01T00:00:00.000Z" });
    const { rows, counts } = parseReviewImport(
      "author_name,rating,review_text,reviewed_at\n" +
        "Ana,5,hi,2026-01-01\n" +
        "Bea,5,hey,2026-01-02\n" +
        "Bea,5,hey,2026-01-02\n",
      [stored],
    );
    expect(rows.map((r) => r.status)).toEqual(["duplicate_existing", "new", "duplicate_file"]);
    expect(counts).toMatchObject({ valid: 1, duplicateExisting: 1, duplicateFile: 1 });
  });

  it("guards the file size and the row ceiling", () => {
    expect(checkImportFileSize(1024)).toBeNull();
    expect(checkImportFileSize(5 * 1024 * 1024)?.code).toBe("file_too_large");
    const many =
      "author_name,rating,review_text\n" +
      Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `A${i},5,text ${i}`).join("\n");
    const { fileIssues, rows } = parseReviewImport(many);
    expect(rows).toEqual([]);
    expect(fileIssues[0].code).toBe("too_many_rows");
  });

  it("reports empty and unparsable files", () => {
    expect(parseReviewImport("  ").fileIssues[0].code).toBe("file_empty");
    expect(parseReviewImport("{bad json").fileIssues[0].code).toBe("invalid_json");
    expect(parseReviewImport('{"reviews": 3}').fileIssues[0].code).toBe("json_not_array");
    expect(parseReviewImport("author_name,rating\n").fileIssues[0].code).toBe("csv_no_rows");
  });

  it("ships a template with the documented columns", () => {
    expect(CSV_TEMPLATE).toMatch(/author_name,rating,review_text,reviewed_at,original_url/);
    expect(parseReviewImport(CSV_TEMPLATE).counts.valid).toBe(2);
  });
});

describe("batching", () => {
  it("splits rows into fixed-size batches without losing any", () => {
    const list = Array.from({ length: 250 }, (_, i) => i);
    const batches = chunk(list, 100);
    expect(batches.map((b) => b.length)).toEqual([100, 100, 50]);
    expect(batches.flat()).toEqual(list);
  });
});

describe("no external review integration anywhere", () => {
  const sql = readFileSync("supabase/pending-migrations/20260817170000_reviews.sql", "utf8");

  it("ships no review sync edge function and no provider secrets", () => {
    expect(existsSync("supabase/functions/reviews-sync")).toBe(false);
    const tracked = execSync("git ls-files supabase src", { encoding: "utf8" });
    expect(tracked).not.toMatch(/reviews-sync/);
    expect(sql).not.toMatch(/review_sync_state/);
    expect(sql).not.toMatch(/GOOGLE_BUSINESS|TRIPADVISOR_API|PLACES_API/);
  });

  it("keeps no provider client code in the review modules", () => {
    const lib = readFileSync("src/lib/reviews.ts", "utf8");
    const dash = readFileSync("src/components/dashboard/DashboardReviews.tsx", "utf8");
    for (const src of [lib, dash]) {
      expect(src).not.toMatch(/googleapis|places\/v1|api_key|apiKey|access_token/i);
      expect(src).not.toMatch(/functions\.invoke/);
    }
  });

  it("stores no source column: nothing can imply a third-party origin", () => {
    expect(sql).not.toMatch(/\bsource\b/i);
    expect(readFileSync("src/lib/reviews.ts", "utf8")).not.toMatch(/allowed_sources/);
  });
});

describe("owner JSON wrapper format", () => {
  const file = JSON.stringify({
    version: 1,
    reviews: [
      {
        source: "google",
        external_id: null,
        author: "Carlos",
        rating: 5,
        title: null,
        text: "Отзыв",
        published_at: "2026-07-15",
        language: "es",
        source_url: "https://maps.example/review",
        is_enabled: true,
        featured: true,
      },
    ],
  });

  it("maps author/text/published_at/source_url/featured", () => {
    const preview = parseReviewImport(file);
    expect(preview.fileIssues).toEqual([]);
    expect(preview.counts.valid).toBe(1);
    const row = preview.rows[0].row!;
    expect(row.author_name).toBe("Carlos");
    expect(row.review_text).toBe("Отзыв");
    expect(row.rating).toBe(5);
    expect(row.reviewed_at).toBe(new Date("2026-07-15").toISOString());
    expect(row.original_url).toBe("https://maps.example/review");
    expect(row.pinned).toBe(true);
  });

  it("never derives visibility from is_enabled and stores no provider fields", () => {
    const row = parseReviewImport(file).rows[0].row!;
    expect(row).not.toHaveProperty("visible");
    expect(row).not.toHaveProperty("is_enabled");
    expect(row).not.toHaveProperty("source");
    expect(row).not.toHaveProperty("external_id");
    expect(row).not.toHaveProperty("title");
    expect(row).not.toHaveProperty("language");
  });

  it("rejects a non-https source_url", () => {
    const bad = JSON.stringify({ reviews: [{ author: "A", rating: 5, text: "T", source_url: "http://x.test/a" }] });
    expect(parseReviewImport(bad).rows[0].issues.map((i) => i.code)).toContain("url_invalid");
  });

  it("treats featured=false as not pinned", () => {
    const off = JSON.stringify({ reviews: [{ author: "B", rating: 5, text: "T2", featured: false }] });
    expect(parseReviewImport(off).rows[0].row!.pinned).toBe(false);
  });
});
