import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  SITE_LOCALES,
  baseLanguage,
  normalizeLanguage,
  localizedReviewText,
  parseReviewImport,
  type Review,
} from "@/lib/reviews";

const review = (p: Partial<Review>): Review => ({
  id: "1",
  dedupe_key: "k",
  author_name: "Ana",
  rating: 5,
  review_text: "Original text",
  original_language: null,
  review_text_es: null,
  review_text_en: null,
  review_text_ru: null,
  reviewed_at: "2026-01-01T00:00:00Z",
  original_url: null,
  visible: true,
  pinned: false,
  manual_priority: 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "",
  imported_at: null,
  ...p,
});

describe("language helpers", () => {
  it("normalizes only plausible lowercase BCP-47 tags", () => {
    expect(normalizeLanguage(" ES ")).toBe("es");
    expect(normalizeLanguage("pt_BR")).toBe("pt-br");
    expect(normalizeLanguage("mul")).toBe("mul");
    expect(normalizeLanguage("")).toBeNull();
    expect(normalizeLanguage("español")).toBeNull();
    expect(normalizeLanguage(42)).toBeNull();
  });

  it("reduces a region tag to its base language", () => {
    expect(baseLanguage("pt-br")).toBe("pt");
    expect(baseLanguage("EN")).toBe("en");
    expect(baseLanguage(null)).toBeNull();
  });
});

describe("localizedReviewText", () => {
  it("shows the stored translation for the page language", () => {
    const r = review({ original_language: "en", review_text: "Great", review_text_es: "Genial" });
    expect(localizedReviewText(r, "es")).toEqual({ text: "Genial", translated: true });
  });

  it("does not label the original language column as a translation", () => {
    const r = review({ original_language: "es", review_text: "Genial", review_text_es: "Genial" });
    expect(localizedReviewText(r, "es")).toEqual({ text: "Genial", translated: false });
  });

  it("treats a region variant as its base language", () => {
    const r = review({ original_language: "pt-br", review_text: "Ótimo", review_text_ru: "Отлично" });
    expect(localizedReviewText(r, "ru").translated).toBe(true);
  });

  it("falls back to the untouched original when a translation is missing or blank", () => {
    const missing = review({ original_language: "en", review_text: "Great" });
    expect(localizedReviewText(missing, "ru")).toEqual({ text: "Great", translated: false });
    const blank = review({ original_language: "en", review_text: "Great", review_text_ru: "   " });
    expect(localizedReviewText(blank, "ru")).toEqual({ text: "Great", translated: false });
  });

  it("labels a mixed-language original as translated in every site language", () => {
    const r = review({
      original_language: "mul",
      review_text: "Great / Genial",
      review_text_es: "Genial",
      review_text_en: "Great",
      review_text_ru: "Отлично",
    });
    for (const locale of SITE_LOCALES) expect(localizedReviewText(r, locale).translated).toBe(true);
  });
});

describe("manual import — translations", () => {
  it("reads the language and per-locale columns from JSON", () => {
    const file = JSON.stringify([
      {
        author_name: "Ana",
        rating: 5,
        review_text: "Great",
        language: "EN",
        review_text_es: "Genial",
        review_text_ru: "Отлично",
      },
    ]);
    const { rows, issues } = parseReviewImport(file, "reviews.json");
    expect(issues).toHaveLength(0);
    expect(rows[0].original_language).toBe("en");
    expect(rows[0].review_text_es).toBe("Genial");
    expect(rows[0].review_text_ru).toBe("Отлично");
    // The original language column mirrors the untouched original text.
    expect(rows[0].review_text_en).toBe("Great");
  });

  it("reads a nested translations object", () => {
    const file = JSON.stringify([
      {
        author_name: "Ana",
        rating: 5,
        review_text: "Genial",
        original_language: "es",
        translations: { en: "Great", ru: "Отлично" },
      },
    ]);
    const { rows } = parseReviewImport(file, "reviews.json");
    expect(rows[0].review_text_en).toBe("Great");
    expect(rows[0].review_text_ru).toBe("Отлично");
    expect(rows[0].review_text_es).toBe("Genial");
  });

  it("leaves translations null and never invents one when the file has none", () => {
    const file = JSON.stringify([{ author_name: "Ana", rating: 5, review_text: "Great" }]);
    const { rows } = parseReviewImport(file, "reviews.json");
    expect(rows[0].original_language).toBeNull();
    expect(rows[0].review_text_es).toBeNull();
    expect(rows[0].review_text_en).toBeNull();
    expect(rows[0].review_text_ru).toBeNull();
  });

  it("reads the translation columns from CSV too", () => {
    const csv =
      "author_name,rating,review_text,original_language,review_text_es,review_text_en,review_text_ru\r\n" +
      'Ana,5,Great,en,Genial,Great,"Отлично"\r\n';
    const { rows, issues } = parseReviewImport(csv, "reviews.csv");
    expect(issues).toHaveLength(0);
    expect(rows[0].original_language).toBe("en");
    expect(rows[0].review_text_es).toBe("Genial");
  });
});

describe("owner-provided translation data file", () => {
  const raw = readFileSync("supabase/pending-data/review-translations-20260817.json", "utf8");
  const data = JSON.parse(raw) as Array<Record<string, unknown>>;

  it("holds 106 rows with unique dedupe keys", () => {
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(106);
    expect(new Set(data.map((r) => r.dedupe_key)).size).toBe(106);
  });

  it("carries only translation fields — no review_text, author or rating overwrites", () => {
    const allowed = new Set([
      "dedupe_key",
      "original_language",
      "review_text_es",
      "review_text_en",
      "review_text_ru",
    ]);
    for (const row of data) for (const key of Object.keys(row)) expect(allowed.has(key)).toBe(true);
  });

  it("has a non-empty ES/EN/RU text and a valid language tag on every row", () => {
    for (const row of data) {
      expect(normalizeLanguage(row.original_language)).toBe(row.original_language);
      for (const locale of SITE_LOCALES) {
        const text = row[`review_text_${locale}`];
        expect(typeof text).toBe("string");
        expect((text as string).trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the two mixed-language reviews tagged as mul", () => {
    const mixed = data.filter((r) => r.original_language === "mul");
    expect(mixed).toHaveLength(2);
  });

  it("stays inside the column limit the migration enforces", () => {
    for (const row of data)
      for (const locale of SITE_LOCALES) expect((row[`review_text_${locale}`] as string).length).toBeLessThanOrEqual(8000);
  });
});
