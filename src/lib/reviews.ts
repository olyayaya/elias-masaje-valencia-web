import {
  REVIEW_SOURCES,
  REVIEW_SORTS,
  TRIPADVISOR_PROFILE_URL,
  reviewSettingsTable,
  reviewSyncStateTable,
  reviewsTable,
  type PendingError,
  type ReviewDisplaySettingsRow,
  type ReviewRow,
  type ReviewSort,
  type ReviewSource,
  type ReviewSyncStateRow,
  type ReviewSyncStatus,
} from "@/integrations/supabase/pending-reviews";

/* ------------------------------------------------------------------ *
 * Real customer reviews — Google Business Profile and manual entries the owner
 * holds the rights to.
 *
 * TripAdvisor is intentionally not a stored source: their Content API terms
 * forbid selective filtering/sorting and commingling their licensed content with
 * third-party reviews. The dashboard links to the TripAdvisor profile instead.
 *
 * The `reviews`, `review_display_settings` and `review_sync_state` tables ship
 * ahead of their migration, so "table not there yet" degrades to an empty list
 * exactly like the gallery does. Nothing in this module ever invents a review.
 * ------------------------------------------------------------------ */

export {
  REVIEW_SOURCES,
  REVIEW_SORTS,
  TRIPADVISOR_PROFILE_URL,
  reviewSettingsTable,
  reviewSyncStateTable,
  reviewsTable,
};
export type { ReviewSort, ReviewSource, ReviewSyncStateRow, ReviewSyncStatus };

export type Review = ReviewRow;
export type ReviewDisplaySettings = ReviewDisplaySettingsRow;

/**
 * Public profile pages. Used as the *source* link when a provider does not hand
 * out a per-review permalink — never presented as the individual review URL.
 */
export const SOURCE_PROFILE_URL: Record<ReviewSource, string | null> = {
  google: "https://maps.app.goo.gl/uyR3ZRdYUFiYSwXt5",
  manual: null,
};

export const REVIEW_COLUMNS =
  "id, source, external_review_id, author_name, author_avatar_url, rating, review_text, review_language, reviewed_at, original_url, visible, pinned, manual_priority, created_at, updated_at, last_synced_at";

/** Ordering inputs (pinned / manual_priority) are part of the public read. */
export const PUBLIC_REVIEW_COLUMNS =
  "id, source, author_name, author_avatar_url, rating, review_text, review_language, reviewed_at, original_url, pinned, manual_priority";

export const REVIEW_SETTINGS_COLUMNS =
  "id, section_enabled, allowed_ratings, allowed_sources, sort_mode, updated_at";

export const REVIEW_SYNC_STATE_COLUMNS =
  "source, last_attempt_at, last_success_at, status, imported_count, updated_count, skipped_count, error_code, error_message, updated_at";

export const DEFAULT_REVIEW_SETTINGS: Omit<ReviewDisplaySettings, "id" | "updated_at"> = {
  section_enabled: true,
  // Only 5★ is on by default; 1–4 are opt-in.
  allowed_ratings: [5],
  allowed_sources: [...REVIEW_SOURCES],
  sort_mode: "newest",
};

export const isReviewSort = (v: unknown): v is ReviewSort =>
  typeof v === "string" && (REVIEW_SORTS as readonly string[]).includes(v);

export const isMissingReviewsTable = (error: PendingError | null) =>
  !!error &&
  (error.code === "42P01" ||
    error.code === "PGRST205" ||
    /does not exist|find the table/i.test(error.message ?? ""));

/* ------------------------------- display ------------------------------- */

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
  const cmp = by[isReviewSort(sort) ? sort : "newest"];
  return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || cmp(a, b));
}

/**
 * The public filter. RLS enforces the same rule server-side; this keeps the
 * homepage honest even when a cached row slips through.
 */
export function publicReviews(list: Review[], settings: ReviewDisplaySettings | null): Review[] {
  const s = settings ?? { ...DEFAULT_REVIEW_SETTINGS, id: "", updated_at: "" };
  if (!s.section_enabled) return [];
  return list.filter(
    (r) =>
      // Hard gate: only licensed sources can ever reach the public section, no
      // matter what a stale settings row or a cached response says.
      (REVIEW_SOURCES as readonly string[]).includes(r.source) &&
      r.visible &&
      (s.allowed_ratings ?? []).includes(r.rating) &&
      (s.allowed_sources ?? []).includes(r.source),
  );
}

/**
 * Exactly what the homepage renders: the public filter, then the persisted
 * `sort_mode` the owner chose in the dashboard. Pinned reviews always lead.
 */
export function displayReviews(list: Review[], settings: ReviewDisplaySettings | null): Review[] {
  const mode = settings && isReviewSort(settings.sort_mode) ? settings.sort_mode : DEFAULT_REVIEW_SETTINGS.sort_mode;
  return sortReviews(publicReviews(list, settings), mode);
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
  if (rawSource === "tripadvisor") {
    // Copied TripAdvisor content cannot be re-published here. There is no flag
    // that turns this into an allowed mode by accident.
    errors.push(
      `Row ${index + 1}: TripAdvisor review content cannot be imported. Use source "manual" with an original_url only for reviews you hold the rights to.`,
    );
    return null;
  }
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
