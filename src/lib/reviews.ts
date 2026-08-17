import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ *
 * Real customer reviews — Google Business Profile / TripAdvisor / manual
 *
 * The `reviews` and `review_display_settings` tables ship ahead of their
 * migration, so "table not there yet" degrades to an empty list exactly like
 * the gallery does. Nothing in this module ever invents a review.
 * ------------------------------------------------------------------ */

export const REVIEW_SOURCES = ["google", "tripadvisor", "manual"] as const;
export type ReviewSource = (typeof REVIEW_SOURCES)[number];

export interface Review {
  id: string;
  source: ReviewSource;
  external_review_id: string;
  author_name: string;
  author_avatar_url: string | null;
  rating: number;
  review_text: string;
  review_language: string | null;
  reviewed_at: string | null;
  original_url: string | null;
  visible: boolean;
  pinned: boolean;
  manual_priority: number;
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
}

export interface ReviewDisplaySettings {
  id: string;
  section_enabled: boolean;
  allowed_ratings: number[];
  allowed_sources: ReviewSource[];
  updated_at: string;
}

/** source_payload is deliberately excluded — it is never read by the client. */
export const REVIEW_COLUMNS =
  "id, source, external_review_id, author_name, author_avatar_url, rating, review_text, review_language, reviewed_at, original_url, visible, pinned, manual_priority, created_at, updated_at, last_synced_at";

export const PUBLIC_REVIEW_COLUMNS =
  "id, source, author_name, author_avatar_url, rating, review_text, review_language, reviewed_at, original_url";

export const DEFAULT_REVIEW_SETTINGS: Omit<ReviewDisplaySettings, "id" | "updated_at"> = {
  section_enabled: true,
  // Only 5★ is on by default; 1–4 are opt-in.
  allowed_ratings: [5],
  allowed_sources: [...REVIEW_SOURCES],
};

export const isMissingReviewsTable = (error: { code?: string; message?: string } | null) =>
  !!error &&
  (error.code === "42P01" ||
    error.code === "PGRST205" ||
    /does not exist|find the table/i.test(error.message ?? ""));

/** Untyped accessors — the reviews tables are not in the generated types yet. */
export const reviewsTable = () =>
  (supabase as unknown as { from: (t: string) => any }).from("reviews");
export const reviewSettingsTable = () =>
  (supabase as unknown as { from: (t: string) => any }).from("review_display_settings");

/* ------------------------------- display ------------------------------- */

export type ReviewSort = "newest" | "oldest" | "rating_high" | "rating_low" | "manual";

const time = (r: Review) => new Date(r.reviewed_at ?? r.created_at).getTime() || 0;

/** Pinned first, then the chosen order. Pure, so the homepage and dashboard agree. */
export function sortReviews(list: Review[], sort: ReviewSort): Review[] {
  const by: Record<ReviewSort, (a: Review, b: Review) => number> = {
    newest: (a, b) => time(b) - time(a),
    oldest: (a, b) => time(a) - time(b),
    rating_high: (a, b) => b.rating - a.rating || time(b) - time(a),
    rating_low: (a, b) => a.rating - b.rating || time(b) - time(a),
    manual: (a, b) => b.manual_priority - a.manual_priority || time(b) - time(a),
  };
  return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || by[sort](a, b));
}

/**
 * The public filter. RLS enforces the same rule server-side; this keeps the
 * homepage honest even when a cached row slips through.
 */
export function publicReviews(list: Review[], settings: ReviewDisplaySettings | null): Review[] {
  const s = settings ?? { ...DEFAULT_REVIEW_SETTINGS, id: "", updated_at: "" };
  if (!s.section_enabled) return [];
  return list.filter(
    (r) => r.visible && s.allowed_ratings.includes(r.rating) && s.allowed_sources.includes(r.source),
  );
}

/* ---------------------------- manual import ---------------------------- */

export interface ParsedImportRow {
  source: ReviewSource;
  external_review_id: string;
  author_name: string;
  rating: number;
  review_text: string;
  reviewed_at: string | null;
  original_url: string | null;
  review_language: string | null;
  author_avatar_url: string | null;
}

export interface ImportParseResult {
  rows: ParsedImportRow[];
  errors: string[];
}

const MAX_IMPORT_ROWS = 500;
const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");

const httpsOnly = (v: string): string | null => {
  if (!v) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
};

/** Minimal RFC4180 CSV reader — quoted fields, doubled quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === ",") { row.push(field); field = ""; continue; }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
      continue;
    }
    field += ch;
  }
  row.push(field);
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

const normalizeRecord = (rec: Record<string, unknown>, index: number, errors: string[]): ParsedImportRow | null => {
  const rawSource = clean(rec.source).toLowerCase();
  const source = (REVIEW_SOURCES as readonly string[]).includes(rawSource)
    ? (rawSource as ReviewSource)
    : null;
  if (!source) {
    errors.push(`Row ${index + 1}: unknown source "${clean(rec.source)}"`);
    return null;
  }
  const rating = Number(rec.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    errors.push(`Row ${index + 1}: rating must be an integer 1–5`);
    return null;
  }
  const author = clean(rec.author_name);
  if (!author) {
    errors.push(`Row ${index + 1}: author_name is required`);
    return null;
  }
  const reviewedRaw = clean(rec.reviewed_at);
  let reviewedAt: string | null = null;
  if (reviewedRaw) {
    const d = new Date(reviewedRaw);
    if (Number.isNaN(d.getTime())) {
      errors.push(`Row ${index + 1}: reviewed_at is not a valid date`);
      return null;
    }
    reviewedAt = d.toISOString();
  }
  const external = clean(rec.external_review_id) || `${author}|${reviewedRaw}|${rating}`;
  return {
    source,
    external_review_id: external.slice(0, 200),
    author_name: author.slice(0, 120),
    rating,
    // Never rewritten, never translated — the customer's own words.
    review_text: clean(rec.review_text).slice(0, 5000),
    reviewed_at: reviewedAt,
    original_url: httpsOnly(clean(rec.original_url)),
    review_language: clean(rec.review_language).slice(0, 12) || null,
    author_avatar_url: httpsOnly(clean(rec.author_avatar_url)),
  };
};

/**
 * Parse an official CSV/JSON export into review rows. Everything is validated
 * before anything is written; the caller shows a preview first.
 */
export function parseReviewImport(text: string): ImportParseResult {
  const errors: string[] = [];
  const trimmed = text.trim();
  if (!trimmed) return { rows: [], errors: ["The file is empty."] };

  let records: Record<string, unknown>[] = [];
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      const list = Array.isArray(parsed) ? parsed : (parsed as { reviews?: unknown }).reviews;
      if (!Array.isArray(list)) return { rows: [], errors: ["Expected a JSON array of reviews."] };
      records = list as Record<string, unknown>[];
    } catch {
      return { rows: [], errors: ["The file is not valid JSON."] };
    }
  } else {
    const table = parseCsv(trimmed);
    if (table.length < 2) return { rows: [], errors: ["The CSV needs a header row and at least one review."] };
    const header = table[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
    records = table.slice(1).map((cells) =>
      Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""])),
    );
  }

  if (records.length > MAX_IMPORT_ROWS) {
    return { rows: [], errors: [`Too many rows (${records.length}). The limit is ${MAX_IMPORT_ROWS}.`] };
  }

  const rows: ParsedImportRow[] = [];
  const seen = new Set<string>();
  records.forEach((rec, i) => {
    const row = normalizeRecord(rec ?? {}, i, errors);
    if (!row) return;
    const key = `${row.source}|${row.external_review_id}`;
    if (seen.has(key)) return; // in-file duplicate: keep the first occurrence
    seen.add(key);
    rows.push(row);
  });
  return { rows, errors };
}
