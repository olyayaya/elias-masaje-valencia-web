import { useQuery } from "@tanstack/react-query";
import {
  DEFAULT_REVIEW_SETTINGS,
  PUBLIC_REVIEW_COLUMNS,
  REVIEW_COLUMNS,
  REVIEW_SETTINGS_COLUMNS,
  REVIEW_SYNC_STATE_COLUMNS,
  isMissingReviewsTable,
  reviewSettingsTable,
  reviewSyncStateTable,
  reviewsTable,
  type Review,
  type ReviewDisplaySettings,
  type ReviewSyncStateRow,
} from "@/lib/reviews";

export const reviewKeys = {
  publicList: ["reviews", "public"] as const,
  adminList: ["reviews", "all"] as const,
  settings: ["review_display_settings"] as const,
  syncState: ["review_sync_state"] as const,
};

const EMPTY: Review[] = [];
const EMPTY_SYNC: ReviewSyncStateRow[] = [];

interface ReviewsResult {
  items: Review[];
  missingTable: boolean;
}

async function loadReviews(adminView: boolean): Promise<ReviewsResult> {
  const { data, error } = await reviewsTable()
    .select<Partial<Review>>(adminView ? REVIEW_COLUMNS : PUBLIC_REVIEW_COLUMNS)
    .order("reviewed_at", { ascending: false, nullsFirst: false });
  if (error) {
    if (isMissingReviewsTable(error)) return { items: EMPTY, missingTable: true };
    throw error;
  }
  // Public rows come back without the moderation columns except the two that
  // drive ordering; fill in the shape the display helpers expect (RLS already
  // filtered the list to visible + allowed rows).
  const rows = data ?? [];
  return {
    items: rows.map((r) => ({
      visible: true,
      pinned: false,
      manual_priority: 0,
      external_review_id: "",
      created_at: r.reviewed_at ?? "",
      updated_at: "",
      last_synced_at: null,
      ...r,
    })) as Review[],
    missingTable: false,
  };
}

async function loadSettings(): Promise<{ settings: ReviewDisplaySettings | null; missingTable: boolean }> {
  const { data, error } = await reviewSettingsTable()
    .select(REVIEW_SETTINGS_COLUMNS)
    .limit(1)
    .maybeSingle();
  if (error) {
    if (isMissingReviewsTable(error)) return { settings: null, missingTable: true };
    throw error;
  }
  return { settings: data ?? null, missingTable: false };
}

async function loadSyncState(): Promise<{ rows: ReviewSyncStateRow[]; missingTable: boolean }> {
  const { data, error } = await reviewSyncStateTable().select(REVIEW_SYNC_STATE_COLUMNS).order("source");
  if (error) {
    if (isMissingReviewsTable(error)) return { rows: EMPTY_SYNC, missingTable: true };
    throw error;
  }
  return { rows: data ?? EMPTY_SYNC, missingTable: false };
}

/** Public homepage reviews (RLS-filtered) plus the display settings. */
export function usePublicReviews() {
  const list = useQuery({ queryKey: reviewKeys.publicList, queryFn: () => loadReviews(false) });
  const settings = useQuery({ queryKey: reviewKeys.settings, queryFn: loadSettings });
  return {
    items: list.data?.items ?? EMPTY,
    settings: settings.data?.settings ?? null,
    missingTable: (list.data?.missingTable ?? false) || (settings.data?.missingTable ?? false),
    isPending: list.isPending || settings.isPending,
    isError: list.isError || settings.isError,
    retry: () => {
      void list.refetch();
      void settings.refetch();
    },
  };
}

/** Every review, moderation columns included — admin only (enforced by RLS). */
export function useAdminReviews() {
  const list = useQuery({ queryKey: reviewKeys.adminList, queryFn: () => loadReviews(true) });
  const settings = useQuery({ queryKey: reviewKeys.settings, queryFn: loadSettings });
  const sync = useQuery({ queryKey: reviewKeys.syncState, queryFn: loadSyncState });
  return {
    items: list.data?.items ?? EMPTY,
    settings:
      settings.data?.settings ?? ({ id: "", updated_at: "", ...DEFAULT_REVIEW_SETTINGS } as ReviewDisplaySettings),
    hasSettingsRow: !!settings.data?.settings,
    syncState: sync.data?.rows ?? EMPTY_SYNC,
    missingTable: (list.data?.missingTable ?? false) || (settings.data?.missingTable ?? false),
    isPending: list.isPending || settings.isPending,
    isError: list.isError || settings.isError,
  };
}
