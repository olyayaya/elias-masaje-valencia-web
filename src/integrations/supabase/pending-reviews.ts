/**
 * Typed access layer for the review tables that ship ahead of their migration.
 *
 * `src/integrations/supabase/types.ts` is generated from the *applied* schema, so
 * it cannot describe `reviews`, `review_display_settings` or `review_sync_state`
 * until the pending migration is applied. Rather than scattering `any` through
 * the app, the row shapes are declared once here and the query builder is given
 * a small, honest surface — the same calls the client really supports.
 *
 * When the migration is applied and types are regenerated, these accessors can be
 * swapped for `supabase.from("reviews")` without touching any caller.
 */
import { supabase } from "@/integrations/supabase/client";

export interface PendingError {
  code?: string;
  message?: string;
  details?: string;
}

interface ListResult<T> {
  data: T[] | null;
  error: PendingError | null;
}
interface RowResult<T> {
  data: T | null;
  error: PendingError | null;
}

export interface SelectBuilder<T> extends PromiseLike<ListResult<T>> {
  eq(column: string, value: unknown): SelectBuilder<T>;
  in(column: string, values: readonly unknown[]): SelectBuilder<T>;
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): SelectBuilder<T>;
  limit(n: number): SelectBuilder<T>;
  maybeSingle(): Promise<RowResult<T>>;
}

export interface MutationBuilder extends PromiseLike<RowResult<unknown>> {
  eq(column: string, value: unknown): MutationBuilder;
  neq(column: string, value: unknown): MutationBuilder;
}

export interface PendingTable<Row, Insert = Partial<Row>> {
  select<T = Row>(columns: string): SelectBuilder<T>;
  insert(rows: Insert[]): MutationBuilder;
  upsert(rows: Insert[], options?: { onConflict?: string; ignoreDuplicates?: boolean }): MutationBuilder;
  update(values: Partial<Row>): MutationBuilder;
}

const pendingTable = <Row, Insert = Partial<Row>>(name: string): PendingTable<Row, Insert> =>
  (supabase as unknown as { from: (t: string) => PendingTable<Row, Insert> }).from(name);

/* --------------------------------------------------------------- rows --- */

/**
 * Sources the site is licensed to store and display.
 *
 * TripAdvisor is deliberately absent: their Content API terms forbid selectively
 * filtering / sorting their reviews and commingling them with third-party
 * reviews, which is exactly what this section does. TripAdvisor content is
 * therefore never imported, stored, filtered or shown here — only linked.
 */
export const REVIEW_SOURCES = ["google", "manual"] as const;
export type ReviewSource = (typeof REVIEW_SOURCES)[number];

/** Public TripAdvisor profile. A link target only — never a content source. */
export const TRIPADVISOR_PROFILE_URL =
  "https://www.tripadvisor.com/Attraction_Review-g187529-d34031094-Reviews-Elias_Massage_Valencia-Valencia_Province_of_Valencia_Valencian_Community.html";

export const REVIEW_SORTS = ["newest", "oldest", "rating_high", "rating_low", "manual"] as const;
export type ReviewSort = (typeof REVIEW_SORTS)[number];

export interface ReviewRow {
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

export interface ReviewInsert {
  source: ReviewSource;
  external_review_id: string;
  author_name: string;
  author_avatar_url?: string | null;
  rating: number;
  review_text: string;
  review_language?: string | null;
  reviewed_at?: string | null;
  original_url?: string | null;
  last_synced_at?: string | null;
}

export interface ReviewDisplaySettingsRow {
  id: string;
  section_enabled: boolean;
  allowed_ratings: number[];
  allowed_sources: ReviewSource[];
  sort_mode: ReviewSort;
  updated_at: string;
}

export type ReviewSyncStatus = "never" | "ok" | "error" | "not_configured" | "rate_limited";

export interface ReviewSyncStateRow {
  source: "google";
  last_attempt_at: string | null;
  last_success_at: string | null;
  status: ReviewSyncStatus;
  imported_count: number;
  updated_count: number;
  skipped_count: number;
  error_code: string | null;
  error_message: string | null;
  updated_at: string;
}

/* ----------------------------------------------------------- accessors --- */

export const reviewsTable = () => pendingTable<ReviewRow, ReviewInsert>("reviews");
export const reviewSettingsTable = () => pendingTable<ReviewDisplaySettingsRow>("review_display_settings");
export const reviewSyncStateTable = () => pendingTable<ReviewSyncStateRow>("review_sync_state");
