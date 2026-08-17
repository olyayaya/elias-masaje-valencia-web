import {
  GOOGLE_PROFILE_URL,
  REVIEW_SORTS,
  TRIPADVISOR_PROFILE_URL,
  reviewSettingsTable,
  reviewsTable,
  type PendingError,
  type ReviewDisplaySettingsRow,
  type ReviewInsert,
  type ReviewRow,
  type ReviewSort,
} from "@/integrations/supabase/pending-reviews";

/* ------------------------------------------------------------------ *
 * Real customer reviews — manual entries only.
 *
 * No provider API, no OAuth, no API key, no scheduled job, no scraping. A review
 * exists because an admin uploaded a CSV/JSON file they prepared, checked the
 * preview and confirmed they hold the rights to publish those texts. Nothing in
 * this module ever invents, edits or translates a review.
 *
 * Identity is a deterministic content hash (author + text + date), so the same
 * review can never be stored twice, even across files with different column
 * layouts.
 * ------------------------------------------------------------------ */

export { GOOGLE_PROFILE_URL, REVIEW_SORTS, TRIPADVISOR_PROFILE_URL, reviewSettingsTable, reviewsTable };
export type { ReviewInsert, ReviewSort };

export type Review = ReviewRow;
export type ReviewDisplaySettings = ReviewDisplaySettingsRow;

export const REVIEW_COLUMNS =
  "id, dedupe_key, author_name, rating, review_text, reviewed_at, original_url, visible, pinned, manual_priority, created_at, updated_at, imported_at";

/** Ordering inputs (pinned / manual_priority) are part of the public read. */
export const PUBLIC_REVIEW_COLUMNS =
  "id, author_name, rating, review_text, reviewed_at, original_url, pinned, manual_priority";

export const REVIEW_SETTINGS_COLUMNS = "id, section_enabled, allowed_ratings, sort_mode, updated_at";

export const DEFAULT_REVIEW_SETTINGS: Omit<ReviewDisplaySettings, "id" | "updated_at"> = {
  section_enabled: true,
  // Only 5★ is on by default; 1–4 are opt-in.
  allowed_ratings: [5],
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
      r.visible &&
      (s.allowed_ratings ?? []).includes(r.rating) &&
      // An incomplete row is never rendered: no invented author, no empty card.
      !!r.author_name.trim() &&
      !!r.review_text.trim(),
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

/** Hard limits, enforced before a single byte is parsed or written. */
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 1000;
/** Rows per insert request. Keeps a single failure small and retryable. */
export const IMPORT_BATCH_SIZE = 100;

export const MAX_AUTHOR_CHARS = 120;
export const MAX_TEXT_CHARS = 5000;

/** Machine-readable problem codes; the dashboard renders them in ES/EN/RU. */
export type ImportIssueCode =
  | "file_too_large"
  | "file_empty"
  | "invalid_json"
  | "json_not_array"
  | "csv_no_rows"
  | "too_many_rows"
  | "author_required"
  | "author_too_long"
  | "rating_invalid"
  | "text_required"
  | "text_too_long"
  | "date_invalid"
  | "url_invalid";

export interface ImportIssue {
  code: ImportIssueCode;
  /** Formatting values for the localized message (limits, offending value…). */
  vars?: Record<string, string>;
}

export interface ParsedImportRow {
  dedupe_key: string;
  author_name: string;
  rating: number;
  review_text: string;
  reviewed_at: string | null;
  original_url: string | null;
  /** From `pinned`/`featured` in the file. Visibility is never taken from the file. */
  pinned: boolean;
}

export type PreviewStatus = "new" | "duplicate_file" | "duplicate_existing" | "invalid";

export interface PreviewRow {
  /** 1-based position in the uploaded file (header excluded for CSV). */
  line: number;
  status: PreviewStatus;
  /** Present unless the row is invalid. */
  row: ParsedImportRow | null;
  /** What the file said, so an invalid row is still recognisable in the preview. */
  raw: { author_name: string; rating: string; review_text: string; reviewed_at: string };
  issues: ImportIssue[];
}

export interface ImportPreview {
  rows: PreviewRow[];
  /** Problems with the file as a whole (too big, unparsable, too many rows). */
  fileIssues: ImportIssue[];
  counts: { total: number; valid: number; duplicateFile: number; duplicateExisting: number; invalid: number };
}

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());

/**
 * HTTPS-only link policy, shared by the import parser and the manual form so a
 * bad link is reported the same way in both places instead of being dropped.
 */
export const httpsOnly = (v: string): { url: string | null; bad: boolean } => {
  if (!v) return { url: null, bad: false };
  try {
    const u = new URL(v);
    return u.protocol === "https:" ? { url: u.toString(), bad: false } : { url: null, bad: true };
  } catch {
    return { url: null, bad: true };
  }
};

/* --------------------------- deduplication key --------------------------- */

/** FNV-1a, run twice with different offsets → a stable 16-hex-char digest. */
const fnv = (input: string, seed: number) => {
  let h = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
};

const normalizeForKey = (v: string) =>
  v
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("en");

/**
 * Stable identity of a review: author + text + calendar day. Deterministic, so
 * re-uploading the same export produces the same key and the database refuses
 * the duplicate instead of showing the customer twice.
 */
export function dedupeKey(input: { author_name: string; review_text: string; reviewed_at: string | null }): string {
  const day = input.reviewed_at ? input.reviewed_at.slice(0, 10) : "";
  const composite = `${normalizeForKey(input.author_name)}\u0000${normalizeForKey(input.review_text)}\u0000${day}`;
  const a = fnv(composite, 0x811c9dc5).toString(16).padStart(8, "0");
  const b = fnv(composite, 0x1000193).toString(16).padStart(8, "0");
  return `${a}${b}`;
}

/* -------------------------------- parsing -------------------------------- */

/** Minimal RFC4180 CSV reader — quoted fields, doubled quotes, CRLF, `;` too. */
export function parseCsv(text: string): string[][] {
  const delimiter = (() => {
    const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
    const commas = (firstLine.match(/,/g) ?? []).length;
    const semis = (firstLine.match(/;/g) ?? []).length;
    return semis > commas ? ";" : ",";
  })();
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = "";
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      continue;
    }
    field += ch;
  }
  row.push(field);
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}

/** Column aliases so a real Google/Maps export or a hand-made sheet both work. */
const FIELD_ALIASES: Record<keyof PreviewRow["raw"], string[]> = {
  author_name: ["author_name", "author", "name", "reviewer", "reviewer_name", "nombre", "autor", "автор", "имя"],
  rating: ["rating", "stars", "score", "valoracion", "valoración", "puntuacion", "оценка", "рейтинг"],
  review_text: ["review_text", "text", "review", "comment", "content", "texto", "reseña", "resena", "отзыв", "текст"],
  reviewed_at: ["reviewed_at", "date", "created_at", "published_at", "fecha", "дата"],
};

const pick = (rec: Record<string, unknown>, field: keyof PreviewRow["raw"]) => {
  for (const alias of FIELD_ALIASES[field]) {
    if (alias in rec) {
      const v = clean(rec[alias]);
      if (v) return v;
    }
  }
  return "";
};

const normalizeRow = (rec: Record<string, unknown>, line: number): PreviewRow => {
  const raw = {
    author_name: pick(rec, "author_name"),
    rating: pick(rec, "rating"),
    review_text: pick(rec, "review_text"),
    reviewed_at: pick(rec, "reviewed_at"),
  };
  const issues: ImportIssue[] = [];

  if (!raw.author_name) issues.push({ code: "author_required" });
  else if (raw.author_name.length > MAX_AUTHOR_CHARS)
    issues.push({ code: "author_too_long", vars: { max: String(MAX_AUTHOR_CHARS) } });

  const rating = Number(raw.rating.replace(",", "."));
  if (!Number.isInteger(rating) || rating < 1 || rating > 5)
    issues.push({ code: "rating_invalid", vars: { value: raw.rating || "—" } });

  if (!raw.review_text) issues.push({ code: "text_required" });
  else if (raw.review_text.length > MAX_TEXT_CHARS)
    issues.push({ code: "text_too_long", vars: { max: String(MAX_TEXT_CHARS) } });

  let reviewedAt: string | null = null;
  if (raw.reviewed_at) {
    const d = new Date(raw.reviewed_at);
    if (Number.isNaN(d.getTime())) issues.push({ code: "date_invalid", vars: { value: raw.reviewed_at } });
    else reviewedAt = d.toISOString();
  }

  const original = httpsOnly(clean(rec.original_url ?? rec.source_url ?? rec.url ?? rec.link));
  if (original.bad) issues.push({ code: "url_invalid" });

  if (issues.length) return { line, status: "invalid", row: null, raw, issues };

  const row: ParsedImportRow = {
    author_name: raw.author_name,
    rating,
    review_text: raw.review_text,
    reviewed_at: reviewedAt,
    original_url: original.url,
    pinned: truthy(rec.pinned ?? rec.featured),
    dedupe_key: dedupeKey({ author_name: raw.author_name, review_text: raw.review_text, reviewed_at: reviewedAt }),
  };
  return { line, status: "new", row, raw, issues: [] };
};

const fileIssue = (code: ImportIssueCode, vars?: Record<string, string>): ImportPreview => ({
  rows: [],
  fileIssues: [{ code, vars }],
  counts: { total: 0, valid: 0, duplicateFile: 0, duplicateExisting: 0, invalid: 0 },
});

/** Size gate, applied to the `File` before it is ever read into memory. */
export const checkImportFileSize = (size: number): ImportIssue | null =>
  size > MAX_IMPORT_BYTES
    ? { code: "file_too_large", vars: { max: String(Math.round(MAX_IMPORT_BYTES / 1024 / 1024)) } }
    : null;

/**
 * Parse a CSV/JSON file into a full preview: every row keeps its position, its
 * status and its problems. Nothing is written; the caller shows this table and
 * lets the owner pick which rows to import.
 */
export function parseReviewImport(text: string, existingKeys: Iterable<string> = []): ImportPreview {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return fileIssue("file_empty");

  let records: Record<string, unknown>[] = [];
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return fileIssue("invalid_json");
    }
    const list = Array.isArray(parsed) ? parsed : (parsed as { reviews?: unknown })?.reviews;
    if (!Array.isArray(list)) return fileIssue("json_not_array");
    records = list.map((r) => (r && typeof r === "object" ? (r as Record<string, unknown>) : {}));
  } else {
    const table = parseCsv(trimmed);
    if (table.length < 2) return fileIssue("csv_no_rows");
    const header = table[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
    records = table.slice(1).map((cells) => Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""])));
  }

  if (records.length > MAX_IMPORT_ROWS)
    return fileIssue("too_many_rows", { count: String(records.length), max: String(MAX_IMPORT_ROWS) });

  const known = new Set(existingKeys);
  const seen = new Set<string>();
  const rows = records.map((rec, i) => {
    const parsed = normalizeRow(rec, i + 1);
    if (!parsed.row) return parsed;
    if (seen.has(parsed.row.dedupe_key)) return { ...parsed, status: "duplicate_file" as const };
    seen.add(parsed.row.dedupe_key);
    if (known.has(parsed.row.dedupe_key)) return { ...parsed, status: "duplicate_existing" as const };
    return parsed;
  });

  return {
    rows,
    fileIssues: [],
    counts: {
      total: rows.length,
      valid: rows.filter((r) => r.status === "new").length,
      duplicateFile: rows.filter((r) => r.status === "duplicate_file").length,
      duplicateExisting: rows.filter((r) => r.status === "duplicate_existing").length,
      invalid: rows.filter((r) => r.status === "invalid").length,
    },
  };
}

/** Split rows into fixed-size batches for the insert loop. */
export const chunk = <T>(list: readonly T[], size = IMPORT_BATCH_SIZE): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

/** The starter file the owner downloads from the dashboard. */
export const CSV_TEMPLATE =
  "\uFEFFauthor_name,rating,review_text,reviewed_at,original_url\r\n" +
  '"Ana García",5,"Muy buen masaje, repetiré.",2026-01-15,\r\n' +
  '"John Smith",5,"Great deep tissue session.",2026-02-03,\r\n';
