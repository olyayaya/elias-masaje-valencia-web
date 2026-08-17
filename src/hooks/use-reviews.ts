import { useQuery } from "@tanstack/react-query";
import {
  DEFAULT_REVIEW_SETTINGS,
  PUBLIC_REVIEW_COLUMNS,
  REVIEW_COLUMNS,
  isMissingReviewsTable,
  reviewSettingsTable,
  reviewsTable,
  type Review,
  type ReviewDisplaySettings,
} from "@/lib/reviews";

export const reviewKeys = {
  publicList: ["reviews", "public"] as const,
  adminList: ["reviews", "all"] as const,
  settings: ["review_display_settings"] as const,
};

const EMPTY: Review[] = [];

interface ReviewsResult {
  items: Review[];
  missingTable: boolean;
}

async function loadReviews(adminView: boolean): Promise<ReviewsResult> {
  const { data, error } = await reviewsTable()
    .select(adminView ? REVIEW_COLUMNS : PUBLIC_REVIEW_COLUMNS)
    .order("reviewed_at", { ascending: false, nullsFirst: false });
  if (error) {
    if (isMissingReviewsTable(error)) return { items: EMPTY, missingTable: true };
    throw error;
  }
  // Public rows come back without the moderation columns; fill in the shape the
  // display helpers expect (RLS already filtered to visible + allowed).
  const rows = (data ?? []) as Partial<Review>[];
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
    .select("id, section_enabled, allowed_ratings, allowed_sources, updated_at")
    .limit(1)
    .maybeSingle();
  if (error) {
    if (isMissingReviewsTable(error)) return { settings: null, missingTable: true };
    throw error;
  }
  if (!data) return { settings: null, missingTable: false };
  return { settings: data as ReviewDisplaySettings, missingTable: false };
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
  return {
    items: list.data?.items ?? EMPTY,
    settings:
      settings.data?.settings ?? ({ id: "", updated_at: "", ...DEFAULT_REVIEW_SETTINGS } as ReviewDisplaySettings),
    hasSettingsRow: !!settings.data?.settings,
    missingTable: (list.data?.missingTable ?? false) || (settings.data?.missingTable ?? false),
    isPending: list.isPending || settings.isPending,
    isError: list.isError || settings.isError,
  };
}
