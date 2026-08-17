/**
 * Pure helpers for the review sync — no Deno, no network, no secrets, so they
 * can be unit-tested directly. Everything here is defensive: provider payloads
 * are untrusted input.
 */

export const MAX_REVIEWS = 200;
export const MAX_PAGES = 20;
/** Hard ceiling on a provider response before it is parsed as JSON. */
export const MAX_RESPONSE_BYTES = 2_000_000;
/** Minimum gap between two syncs of the same source. */
export const RATE_LIMIT_MS = 60_000;

/**
 * Public profile pages. Used only as the *source* link when a provider does not
 * expose a per-review permalink. Never stored as the individual review URL.
 */
export const SOURCE_PROFILE_URL = {
  google: "https://maps.app.goo.gl/uyR3ZRdYUFiYSwXt5",
  tripadvisor:
    "https://www.tripadvisor.com/Attraction_Review-g187529-d34031094-Reviews-Elias_Massage_Valencia-Valencia_Province_of_Valencia_Valencian_Community.html",
} as const;

export interface NormalizedReview {
  source: "google" | "tripadvisor";
  external_review_id: string;
  author_name: string;
  author_avatar_url: string | null;
  rating: number;
  review_text: string;
  review_language: string | null;
  reviewed_at: string | null;
  original_url: string | null;
}

export const httpsOnly = (v: unknown): string | null => {
  if (typeof v !== "string" || !v) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
};

export const clip = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

export const normalizeDate = (v: unknown): string | null => {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const d = new Date(v);
  const t = d.getTime();
  if (Number.isNaN(t)) return null;
  // Anything outside a sane window is a provider bug, not a review date.
  const year = d.getUTCFullYear();
  if (year < 2000 || t > Date.now() + 86_400_000) return null;
  return d.toISOString();
};

const STAR_WORDS: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

export const normalizeRating = (v: unknown): number => {
  if (typeof v === "string" && STAR_WORDS[v.toUpperCase()]) return STAR_WORDS[v.toUpperCase()];
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 && n <= 5 ? Math.round(n) : 0;
};

/** A review is only stored when it carries an id, an author and a real rating. */
export const isUsable = (r: NormalizedReview): boolean =>
  !!r.external_review_id && !!r.author_name && r.rating >= 1 && r.rating <= 5;

/** Keep the first occurrence of every external id inside one provider response. */
export function dedupe(list: NormalizedReview[]): NormalizedReview[] {
  const seen = new Set<string>();
  const out: NormalizedReview[] = [];
  for (const r of list) {
    if (seen.has(r.external_review_id)) continue;
    seen.add(r.external_review_id);
    out.push(r);
  }
  return out;
}

/**
 * Accepts either a raw id ("12345") or a full resource name
 * ("accounts/12345", "accounts/12345/locations/678"). Each id segment is encoded
 * on its own so the slashes of the resource path survive.
 */
export function googleLocationPath(accountRaw: string, locationRaw: string): string {
  const seg = (v: string) => v.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  const account = seg(accountRaw.trim()).replace(/^accounts\//, "");
  const location = seg(locationRaw.trim()).replace(/^locations\//, "");
  if (!account || !location) throw new Error("invalid google resource ids");
  // A location id given as "accounts/x/locations/y" already carries its account.
  if (location.includes("locations/")) return location.startsWith("accounts/") ? location : `accounts/${account}/${location}`;
  return `accounts/${account}/locations/${location}`;
}

export function normalizeGoogleReview(r: Record<string, unknown>): NormalizedReview {
  const reviewer = (r.reviewer ?? {}) as Record<string, unknown>;
  const rawId = clip(r.reviewId, 200) || clip(r.name, 200);
  return {
    source: "google",
    // Resource names are unique but long; the trailing segment is the review id.
    external_review_id: rawId.includes("/") ? rawId.split("/").pop()!.slice(0, 200) : rawId,
    author_name: clip(reviewer.displayName, 120) || "Google user",
    author_avatar_url: httpsOnly(reviewer.profilePhotoUrl),
    rating: normalizeRating(r.starRating),
    review_text: clip(r.comment, 5000),
    review_language: null,
    reviewed_at: normalizeDate(r.updateTime ?? r.createTime),
    // The Business Profile API does not return a per-review permalink. Rather
    // than pass off the reply URI as one, the card falls back to the public
    // Google profile link on the client.
    original_url: null,
  };
}

export function normalizeTripadvisorReview(r: Record<string, unknown>): NormalizedReview {
  const user = (r.user ?? {}) as Record<string, unknown>;
  const avatar = ((user.avatar ?? {}) as Record<string, unknown>).small as Record<string, unknown> | undefined;
  return {
    source: "tripadvisor",
    external_review_id: clip(String(r.id ?? ""), 200),
    author_name: clip(user.username, 120) || "TripAdvisor user",
    author_avatar_url: httpsOnly(avatar?.url),
    rating: normalizeRating(r.rating),
    review_text: clip(r.text, 5000),
    review_language: clip(r.lang, 12) || null,
    reviewed_at: normalizeDate(r.published_date),
    original_url: httpsOnly(r.url),
  };
}

export const asArray = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Record<string, unknown>[]) : [];

/** Google page cursor, only when it is a usable non-empty string. */
export const nextPageToken = (payload: Record<string, unknown>): string | null => {
  const t = payload.nextPageToken;
  return typeof t === "string" && t.trim() ? t.trim() : null;
};

/** Milliseconds a caller still has to wait, 0 when the source is free to sync. */
export function cooldownRemainingMs(lastAttemptAt: string | null | undefined, now = Date.now()): number {
  if (!lastAttemptAt) return 0;
  const t = new Date(lastAttemptAt).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, RATE_LIMIT_MS - (now - t));
}

/**
 * Reads at most MAX_RESPONSE_BYTES and only then parses. A hostile or broken
 * provider can therefore not exhaust the function's memory. The body is never
 * logged.
 */
export async function readJsonLimited(res: {
  body: ReadableStream<Uint8Array> | null;
  text?: () => Promise<string>;
}): Promise<Record<string, unknown>> {
  let text = "";
  if (res.body) {
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("provider response too large");
      }
      chunks.push(value);
    }
    const merged = new Uint8Array(size);
    let at = 0;
    for (const c of chunks) {
      merged.set(c, at);
      at += c.byteLength;
    }
    text = new TextDecoder().decode(merged);
  } else if (res.text) {
    text = await res.text();
    if (text.length > MAX_RESPONSE_BYTES) throw new Error("provider response too large");
  }
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    throw new Error("provider response was not valid JSON");
  }
}
