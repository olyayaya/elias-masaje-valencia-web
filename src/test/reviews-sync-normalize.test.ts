import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  MAX_RESPONSE_BYTES,
  RATE_LIMIT_MS,
  SOURCE_PROFILE_URL,
  asArray,
  cooldownRemainingMs,
  dedupe,
  googleLocationPath,
  httpsOnly,
  isUsable,
  nextPageToken,
  normalizeDate,
  normalizeGoogleReview,
  normalizeRating,
  readJsonLimited,
} from "../../supabase/functions/reviews-sync/normalize";

describe("google resource ids", () => {
  it("accepts raw ids", () => {
    expect(googleLocationPath("123", "456")).toBe("accounts/123/locations/456");
  });

  it("accepts full resource names without mangling the slashes", () => {
    expect(googleLocationPath("accounts/123", "locations/456")).toBe("accounts/123/locations/456");
    expect(googleLocationPath("123", "accounts/123/locations/456")).toBe("accounts/123/locations/456");
  });

  it("encodes each segment on its own", () => {
    expect(googleLocationPath("a b", "c d")).toBe("accounts/a%20b/locations/c%20d");
  });

  it("refuses empty ids", () => {
    expect(() => googleLocationPath("", "456")).toThrow();
  });
});

describe("normalization", () => {
  it("maps a Google review and never uses the reply uri as a permalink", () => {
    const r = normalizeGoogleReview({
      reviewId: "accounts/1/locations/2/reviews/abc",
      reviewer: { displayName: "Ana", profilePhotoUrl: "https://img.example/a.jpg" },
      starRating: "FIVE",
      comment: "Great",
      updateTime: "2026-02-01T10:00:00Z",
      reviewReply: { uri: "https://reply.example/not-a-permalink" },
    });
    expect(r).toMatchObject({
      source: "google",
      external_review_id: "abc",
      author_name: "Ana",
      rating: 5,
      original_url: null,
    });
    expect(r.reviewed_at).toBe("2026-02-01T10:00:00.000Z");
  });

  it("drops insecure avatars and rejects unusable rows", () => {
    const r = normalizeGoogleReview({
      reviewId: "x",
      reviewer: { displayName: "Bo", profilePhotoUrl: "http://img.example/a.jpg" },
      starRating: "ZERO",
    });
    expect(r.author_avatar_url).toBeNull();
    expect(r.rating).toBe(0);
    expect(isUsable(r)).toBe(false);
  });

  it("invents no author name and skips the anonymous record", () => {
    const r = normalizeGoogleReview({ reviewId: "z", reviewer: {}, starRating: "FIVE", comment: "Great" });
    expect(r.author_name).toBe("");
    expect(r.author_name).not.toMatch(/user/i);
    expect(isUsable(r)).toBe(false);
  });

  it("normalizes ratings, dates and urls defensively", () => {
    expect(normalizeRating(4.4)).toBe(4);
    expect(normalizeRating(7)).toBe(0);
    expect(normalizeRating("THREE")).toBe(3);
    expect(normalizeDate("not a date")).toBeNull();
    expect(normalizeDate("1970-01-01")).toBeNull();
    expect(normalizeDate(Date.now() + 10 * 86_400_000)).toBeNull();
    expect(httpsOnly("http://x.example")).toBeNull();
    expect(httpsOnly("https://x.example/")).toBe("https://x.example/");
  });

  it("deduplicates ids inside one provider response", () => {
    const list = [
      normalizeGoogleReview({ reviewId: "a", reviewer: { displayName: "A" }, starRating: "FIVE" }),
      normalizeGoogleReview({ reviewId: "a", reviewer: { displayName: "A" }, starRating: "FIVE" }),
      normalizeGoogleReview({ reviewId: "b", reviewer: { displayName: "B" }, starRating: "FOUR" }),
    ];
    expect(dedupe(list).map((r) => r.external_review_id)).toEqual(["a", "b"]);
  });

  it("only follows a real page cursor", () => {
    expect(nextPageToken({ nextPageToken: "t" })).toBe("t");
    expect(nextPageToken({ nextPageToken: "  " })).toBeNull();
    expect(nextPageToken({})).toBeNull();
    expect(asArray({ nope: 1 })).toEqual([]);
    expect(asArray([{ a: 1 }, null, 2])).toHaveLength(1);
  });
});

describe("cooldown", () => {
  it("blocks a second sync inside the window and frees it afterwards", () => {
    const now = Date.now();
    expect(cooldownRemainingMs(null, now)).toBe(0);
    expect(cooldownRemainingMs(new Date(now - 1000).toISOString(), now)).toBeGreaterThan(0);
    expect(cooldownRemainingMs(new Date(now - RATE_LIMIT_MS - 1).toISOString(), now)).toBe(0);
    expect(cooldownRemainingMs("garbage", now)).toBe(0);
    expect(RATE_LIMIT_MS).toBeGreaterThanOrEqual(60_000);
  });
});

describe("bounded provider parsing", () => {
  const stream = (text: string) =>
    new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode(text));
        c.close();
      },
    });

  it("parses a normal payload", async () => {
    await expect(readJsonLimited({ body: stream('{"ok":true}') })).resolves.toEqual({ ok: true });
  });

  it("rejects invalid JSON and oversized bodies", async () => {
    await expect(readJsonLimited({ body: stream("<html>") })).rejects.toThrow(/valid JSON/);
    const huge = "x".repeat(MAX_RESPONSE_BYTES + 10);
    await expect(readJsonLimited({ body: stream(huge) })).rejects.toThrow(/too large/);
  });
});

describe("reviews-sync edge function source", () => {
  const fn = readFileSync("supabase/functions/reviews-sync/index.ts", "utf8");

  it("declares explicit CORS instead of an unreliable npm subpath", () => {
    expect(fn).not.toMatch(/@supabase\/supabase-js@2\/cors/);
    expect(fn).toMatch(/Access-Control-Allow-Headers'?:\s*'authorization, x-client-info, apikey, content-type'/);
  });

  it("is admin only, POST only, and rate limited", () => {
    expect(fn).toMatch(/has_role/);
    expect(fn).toMatch(/method_not_allowed'\s*},\s*405/);
    expect(fn).toMatch(/'Retry-After'/);
    expect(fn).toMatch(/review_sync_state/);
  });

  it("never rewrites moderation fields and never logs secrets", () => {
    expect(fn).not.toMatch(/visible:\s*(true|false)/);
    expect(fn).not.toMatch(/pinned:\s*(true|false)/);
    expect(fn).not.toMatch(/manual_priority:/);
    expect(fn).not.toMatch(/console\.(log|error)\([^)]*(token|headers|body)/i);
  });

  it("exposes the documented public profile fallback for Google only", () => {
    expect(SOURCE_PROFILE_URL.google).toBe("https://maps.app.goo.gl/uyR3ZRdYUFiYSwXt5");
    expect(Object.keys(SOURCE_PROFILE_URL)).toEqual(["google"]);
  });
});

describe("tripadvisor compliance gating", () => {
  const fn = readFileSync("supabase/functions/reviews-sync/index.ts", "utf8");
  const norm = readFileSync("supabase/functions/reviews-sync/normalize.ts", "utf8");

  it("answers compliance_required without an error status", () => {
    expect(fn).toMatch(/compliance_required/);
    expect(fn).toMatch(/COMPLIANCE_BLOCKED\.has\(source\)/);
    // The refusal is a normal 200 answer, never a 500.
    expect(fn).not.toMatch(/compliance_required[^\n]*,\s*5\d\d/);
  });

  it("performs no TripAdvisor request anywhere in the function", () => {
    const code = `${fn}\n${norm}`;
    expect(code).not.toMatch(/api\.content\.tripadvisor\.com/);
    expect(code).not.toMatch(/TRIPADVISOR_CONTENT_API_KEY/);
    expect(code).not.toMatch(/TRIPADVISOR_LOCATION_ID/);
    expect(code).not.toMatch(/fetchTripadvisor/);
    expect(norm).not.toMatch(/normalizeTripadvisorReview/);
  });

  it("keeps tripadvisor out of every synced/stored source list", () => {
    // Only Google is a configured, fetchable source.
    expect(fn).toMatch(/const REQUIRED[^}]*google[^}]*}/s);
    expect(fn).not.toMatch(/tripadvisor:\s*\[/);
  });
});
