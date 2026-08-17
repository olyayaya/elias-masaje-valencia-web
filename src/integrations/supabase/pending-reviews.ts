/**
 * Typed access layer for the review tables that ship ahead of their migration.
 *
 * `src/integrations/supabase/types.ts` is generated from the *applied* schema, so
 * it cannot describe `reviews` or `review_display_settings` until the pending
 * migration is applied. Rather than scattering `any` through the app, the row
 * shapes are declared once here and the query builder is given a small, honest
 * surface — the same calls the client really supports.
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
  /**
   * PostgREST returns the rows a mutation actually wrote. With
   * `ignoreDuplicates: true` the conflicting rows are simply absent, which is
   * the only honest way to count what an import really added.
   */
  select<T = unknown>(columns: string): PromiseLike<ListResult<T>>;
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
 * There is no review "source" in this product any more.
 *
 * Every review is a manual entry: the owner types or uploads reviews they hold
 * the rights to publish, and confirms that before anything is written. No
 * provider API, no OAuth, no API keys, no background job, no scraping and no
 * third-party branding anywhere in the pipeline. A review reaches the database
 * exactly one way — an admin-confirmed CSV/JSON import.
 */

/**
 * Public profile links the dashboard may show as plain "where reviews live"
 * pointers. They are never used as a content source and never rendered as the
 * origin of a stored review.
 */
export const GOOGLE_PROFILE_URL = "https://maps.app.goo.gl/uyR3ZRdYUFiYSwXt5";
export const TRIPADVISOR_PROFILE_URL =
  "https://www.tripadvisor.com/Attraction_Review-g187529-d34031094-Reviews-Elias_Massage_Valencia-Valencia_Province_of_Valencia_Valencian_Community.html";

export const REVIEW_SORTS = ["newest", "oldest", "rating_high", "rating_low", "manual"] as const;
export type ReviewSort = (typeof REVIEW_SORTS)[number];

export interface ReviewRow {
  id: string;
  /** Deterministic content hash (author + text + date). The only identity. */
  dedupe_key: string;
  author_name: string;
  rating: number;
  review_text: string;
  reviewed_at: string | null;
  original_url: string | null;
  visible: boolean;
  pinned: boolean;
  manual_priority: number;
  created_at: string;
  updated_at: string;
  /** When this row arrived through a manual import. */
  imported_at: string | null;
}

export interface ReviewInsert {
  dedupe_key: string;
  author_name: string;
  rating: number;
  review_text: string;
  reviewed_at?: string | null;
  original_url?: string | null;
  visible?: boolean;
  pinned?: boolean;
  manual_priority?: number;
  imported_at?: string | null;
}

export interface ReviewDisplaySettingsRow {
  id: string;
  section_enabled: boolean;
  allowed_ratings: number[];
  sort_mode: ReviewSort;
  updated_at: string;
}

/* ----------------------------------------------------------- accessors --- */

export const reviewsTable = () => pendingTable<ReviewRow, ReviewInsert>("reviews");
export const reviewSettingsTable = () => pendingTable<ReviewDisplaySettingsRow>("review_display_settings");
