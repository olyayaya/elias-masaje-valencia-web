import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The reviews migration is still pending, so these checks are the only guard on
 * its shape until it is applied during the rollout.
 */
const sql = readFileSync("supabase/pending-migrations/20260817170000_reviews.sql", "utf8");

describe("reviews migration — structure", () => {
  it("is additive: nothing existing is dropped", () => {
    expect(sql).not.toMatch(/drop table/i);
    expect(sql).not.toMatch(/(drop|alter|delete from)\s+(table\s+)?(public\.)?testimonials/i);
  });

  it("never creates a raw provider payload column", () => {
    expect(sql).not.toMatch(/source_payload/);
  });

  it("constrains the dedupe key, ratings, texts, urls and the sort mode", () => {
    expect(sql).toMatch(/btrim\(dedupe_key\) <> ''/);
    expect(sql).toMatch(/UNIQUE \(dedupe_key\)/);
    expect(sql).toMatch(/rating\s+integer NOT NULL CHECK \(rating BETWEEN 1 AND 5\)/);
    expect(sql).toMatch(/btrim\(author_name\) <> ''/);
    expect(sql).toMatch(/btrim\(review_text\) <> ''/);
    expect(sql).toMatch(/original_url IS NULL OR original_url ~ '\^https:\/\/'/);
    expect(sql).toMatch(/allowed_ratings <@ ARRAY\[1,2,3,4,5\]/);
    expect(sql).toMatch(/sort_mode IN \('newest','oldest','rating_high','rating_low','manual'\)/);
  });

  it("defaults to 5★ only, the section on and newest first", () => {
    expect(sql).toMatch(/allowed_ratings\s+integer\[\] NOT NULL DEFAULT '\{5\}'/);
    expect(sql).toMatch(/section_enabled\s+boolean NOT NULL DEFAULT true/);
    expect(sql).toMatch(/sort_mode\s+text NOT NULL DEFAULT 'newest'/);
  });
});

describe("reviews migration — manual entries only", () => {
  it("keeps no source column, no sync state and no automated plumbing", () => {
    expect(sql).not.toMatch(/review_sync_state/);
    expect(sql).not.toMatch(/last_attempt_at|imported_count|rate_limited/);
    expect(sql).not.toMatch(/allowed_sources/);
    expect(sql).not.toMatch(/external_review_id/);
    // No column, constraint or policy can carry a provider name.
    expect(sql).not.toMatch(/\bsource\b/i);
    expect(sql).not.toMatch(/tripadvisor|google/i);
  });

  it("tracks when a row was added by an admin", () => {
    expect(sql).toMatch(/imported_at\s+timestamptz/);
    expect(sql).not.toMatch(/last_synced_at/);
  });
});

describe("reviews migration — RLS and grants", () => {
  it("enables RLS on both tables", () => {
    for (const t of ["reviews", "review_display_settings"]) {
      expect(sql).toMatch(new RegExp(`ALTER TABLE public\\.${t} ENABLE ROW LEVEL SECURITY`));
    }
  });

  it("limits anon to the public card columns", () => {
    const anonGrant = sql.match(/GRANT SELECT \(([\s\S]*?)\) ON public\.reviews TO anon;/);
    expect(anonGrant).toBeTruthy();
    const cols = anonGrant![1];
    expect(cols).not.toMatch(/visible/);
    expect(cols).not.toMatch(/dedupe_key/);
    expect(cols).toMatch(/pinned/);
    expect(cols).toMatch(/manual_priority/);
  });

  it("gates the anon read behind the visibility function and gives admins full control", () => {
    expect(sql).toMatch(/USING \(public\.review_is_public\(rating, visible\)\)/);
    expect(sql).toMatch(/Admins manage reviews[\s\S]*has_role\(auth\.uid\(\), 'admin'::app_role\)/);
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.review_is_public/);
  });

  it("grants the tables to authenticated and service_role", () => {
    expect(sql).toMatch(/GRANT SELECT, INSERT, UPDATE, DELETE ON public\.reviews TO authenticated;/);
    expect(sql).toMatch(/GRANT ALL ON public\.reviews TO service_role;/);
    expect(sql).toMatch(/GRANT ALL ON public\.review_display_settings TO service_role;/);
  });
});

describe("reviews migration — default privileges are revoked first", () => {
  const revokeIdx = (t: string) =>
    sql.search(new RegExp(`REVOKE ALL PRIVILEGES ON TABLE public\\.${t} FROM anon, authenticated;`));

  it("revokes Supabase default grants on both tables", () => {
    expect(revokeIdx("reviews")).toBeGreaterThan(-1);
    expect(revokeIdx("review_display_settings")).toBeGreaterThan(-1);
  });

  it("revokes before any targeted GRANT on those tables", () => {
    const firstGrant = sql.search(/GRANT SELECT, INSERT, UPDATE, DELETE ON public\.reviews TO authenticated;/);
    expect(revokeIdx("reviews")).toBeLessThan(firstGrant);
    expect(revokeIdx("review_display_settings")).toBeLessThan(firstGrant);
  });

  it("never grants anon table-level writes or TRUNCATE", () => {
    const anonGrants = sql
      .split(";")
      .map((s) => s.replace(/^\s*(--[^\n]*\n)+/, "").trim())
      .filter((s) => /^GRANT[\s\S]*TO anon$/.test(s));
    expect(anonGrants.length).toBe(2);
    for (const g of anonGrants) {
      // Only the privilege list matters; the column list may contain words like
      // "allowed_ratings" that would trip a naive keyword search.
      const privileges = g.slice(0, g.indexOf("("));
      expect(privileges).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER|ALL)\b/i);
      expect(g).toMatch(/GRANT SELECT \(/);
    }
    expect(sql).not.toMatch(/GRANT ALL[\s\S]{0,80}TO anon/i);
  });
});

describe("reviews migration — manual priority range", () => {
  it("bounds manual_priority to the range the dashboard allows", () => {
    expect(sql).toMatch(/manual_priority\s+integer NOT NULL DEFAULT 0 CHECK \(manual_priority BETWEEN -999 AND 999\)/);
  });
});
