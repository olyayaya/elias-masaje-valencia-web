import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Both migrations are still pending, so these checks are the only guard on the
 * translation columns until the rollout applies them.
 */
const additive = readFileSync("supabase/pending-migrations/20260818090000_review_translations.sql", "utf8");
const fresh = readFileSync("supabase/pending-migrations/20260817170000_reviews.sql", "utf8");

describe("review translations — additive migration", () => {
  it("only adds columns; it never drops or rewrites data", () => {
    expect(additive).not.toMatch(/drop\s+(table|column)/i);
    expect(additive).not.toMatch(/\b(update|delete from|truncate table)\s+public\.reviews/i);
  });

  it("adds the four columns idempotently", () => {
    for (const col of ["original_language", "review_text_es", "review_text_en", "review_text_ru"])
      expect(additive).toMatch(new RegExp(`ADD COLUMN IF NOT EXISTS ${col}\\s+text`));
  });

  it("guards every constraint behind a pg_constraint lookup so a rerun is safe", () => {
    const guards = additive.match(/FROM pg_constraint/g) ?? [];
    expect(guards).toHaveLength(4);
    for (const name of [
      "reviews_original_language_check",
      "reviews_review_text_es_check",
      "reviews_review_text_en_check",
      "reviews_review_text_ru_check",
    ])
      expect(additive).toContain(name);
  });

  it("accepts NULL but rejects a blank or oversized translation", () => {
    for (const locale of ["es", "en", "ru"]) {
      const re = new RegExp(
        `review_text_${locale} IS NULL OR \\(btrim\\(review_text_${locale}\\) <> '' AND length\\(review_text_${locale}\\) <= 8000\\)`,
      );
      expect(additive).toMatch(re);
    }
  });

  it("constrains the language tag to a lowercase BCP-47-ish value", () => {
    expect(additive).toMatch(/original_language IS NULL/);
    expect(additive).toMatch(/\^\[a-z\]\{2,3\}\(-\[a-z0-9\]\{2,8\}\)\*\$/);
  });

  it("revokes every anon privilege before granting the single column-level SELECT", () => {
    const revoke = additive.search(/REVOKE ALL PRIVILEGES ON TABLE public\.reviews FROM anon;/);
    expect(revoke).toBeGreaterThan(-1);

    const grants = additive.match(/GRANT SELECT \(([\s\S]*?)\)\s*ON public\.reviews TO anon;/g) ?? [];
    expect(grants).toHaveLength(1);
    expect(additive.indexOf(grants[0])).toBeGreaterThan(revoke);

    const columns = (grants[0].match(/\(([\s\S]*?)\)/)?.[1] ?? "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    expect(columns).toEqual([
      "id",
      "author_name",
      "rating",
      "review_text",
      "original_language",
      "review_text_es",
      "review_text_en",
      "review_text_ru",
      "reviewed_at",
      "original_url",
      "pinned",
      "manual_priority",
    ]);
    expect(columns).toHaveLength(12);
  });

  it("never hands anon a table-level privilege", () => {
    const anonGrants = additive.match(/GRANT[\s\S]*?TO anon;/g) ?? [];
    expect(anonGrants).toHaveLength(1);
    for (const grant of anonGrants) expect(grant).toMatch(/GRANT SELECT \(/);
    expect(additive).not.toMatch(/GRANT\s+(ALL|INSERT|UPDATE|DELETE|SELECT)\s+ON[^;]*TO anon/i);
  });


  it("adds no provider, key, cron or payload column", () => {
    expect(additive).not.toMatch(/source_payload|api_key|cron|http|extension/i);
  });
});

describe("review translations — fresh install migration stays in sync", () => {
  it("declares the same four columns", () => {
    for (const col of ["original_language", "review_text_es", "review_text_en", "review_text_ru"])
      expect(fresh).toMatch(new RegExp(`\\b${col}\\b`));
  });

  it("applies the same blank/length rule to every translation column", () => {
    for (const locale of ["es", "en", "ru"])
      expect(fresh).toMatch(new RegExp(`btrim\\(review_text_${locale}\\) <> ''`));
  });

  it("exposes the translation columns to anon through SELECT only", () => {
    expect(fresh).toMatch(/GRANT SELECT \([^)]*review_text_ru[^)]*\)\s*\n?\s*ON (TABLE )?public\.reviews TO anon/);
  });
});
