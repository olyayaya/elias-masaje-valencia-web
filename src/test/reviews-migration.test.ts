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

  it("constrains ids, ratings, urls and the sort mode", () => {
    expect(sql).toMatch(/btrim\(external_review_id\) <> ''/);
    expect(sql).toMatch(/rating\s+integer NOT NULL CHECK \(rating BETWEEN 1 AND 5\)/);
    expect(sql).toMatch(/author_avatar_url IS NULL OR author_avatar_url ~ '\^https:\/\/'/);
    expect(sql).toMatch(/original_url IS NULL OR original_url ~ '\^https:\/\/'/);
    expect(sql).toMatch(/allowed_ratings <@ ARRAY\[1,2,3,4,5\]/);
    expect(sql).toMatch(/allowed_sources <@ ARRAY\['google','tripadvisor','manual'\]/);
    expect(sql).toMatch(/sort_mode IN \('newest','oldest','rating_high','rating_low','manual'\)/);
    expect(sql).toMatch(/UNIQUE \(source, external_review_id\)/);
  });

  it("defaults to 5★ only, the section on and newest first", () => {
    expect(sql).toMatch(/allowed_ratings\s+integer\[\] NOT NULL DEFAULT '\{5\}'/);
    expect(sql).toMatch(/section_enabled\s+boolean NOT NULL DEFAULT true/);
    expect(sql).toMatch(/sort_mode\s+text NOT NULL DEFAULT 'newest'/);
  });
});

describe("reviews migration — per-source sync state", () => {
  it("creates one admin-only row per automated source", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.review_sync_state/);
    expect(sql).toMatch(/last_attempt_at|last_success_at/);
    expect(sql).toMatch(/imported_count[\s\S]*updated_count[\s\S]*skipped_count/);
    expect(sql).toMatch(/status IN \('never','ok','error','not_configured','rate_limited'\)/);
    expect(sql).toMatch(/INSERT INTO public\.review_sync_state \(source\) VALUES \('google'\), \('tripadvisor'\)/);
  });

  it("never grants anon access to the sync state", () => {
    const grants = sql.match(/GRANT[^;]*review_sync_state[^;]*;/gi) ?? [];
    expect(grants.length).toBeGreaterThan(0);
    expect(grants.some((g) => /anon/i.test(g))).toBe(false);
  });
});

describe("reviews migration — RLS and grants", () => {
  it("enables RLS on all three tables", () => {
    for (const t of ["reviews", "review_display_settings", "review_sync_state"]) {
      expect(sql).toMatch(new RegExp(`ALTER TABLE public\\.${t} ENABLE ROW LEVEL SECURITY`));
    }
  });

  it("limits anon to the public card columns", () => {
    const anonGrant = sql.match(/GRANT SELECT \(([\s\S]*?)\) ON public\.reviews TO anon;/);
    expect(anonGrant).toBeTruthy();
    const cols = anonGrant![1];
    expect(cols).not.toMatch(/visible/);
    expect(cols).not.toMatch(/external_review_id/);
    expect(cols).toMatch(/pinned/);
    expect(cols).toMatch(/manual_priority/);
  });

  it("gates the anon read behind the visibility function and gives admins full control", () => {
    expect(sql).toMatch(/USING \(public\.review_is_public\(rating, source, visible\)\)/);
    expect(sql).toMatch(/Admins manage reviews[\s\S]*has_role\(auth\.uid\(\), 'admin'::app_role\)/);
    expect(sql).toMatch(/Admins read review sync state[\s\S]*has_role/);
  });

  it("pins search_path and revokes the definer function from PUBLIC", () => {
    expect(sql).toMatch(/SECURITY DEFINER[\s\S]*SET search_path = public/);
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.review_is_public\(integer, text, boolean\) FROM PUBLIC/);
  });
});
