/**
 * Public gallery filtering + sorting.
 *
 * Pure so the toolbar, the grid and the lightbox always agree on the exact same,
 * already-filtered/sorted list (lightbox navigation follows the visible set).
 */

import type { GalleryItem } from "@/lib/gallery";

export type GalleryFilter = "all" | "photo" | "video";
export type GallerySort = "manual" | "newest" | "oldest" | "popular";

export const GALLERY_FILTERS: GalleryFilter[] = ["all", "photo", "video"];
export const GALLERY_SORTS: GallerySort[] = ["manual", "newest", "oldest", "popular"];

export const DEFAULT_FILTER: GalleryFilter = "all";
/** Manual order is the default so the Dashboard position actually means something. */
export const DEFAULT_SORT: GallerySort = "manual";

const manualRank = (a: GalleryItem, b: GalleryItem) =>
  (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id);

const time = (value: string | null | undefined) => {
  const t = Date.parse(value ?? "");
  return Number.isFinite(t) ? t : 0;
};

export function filterGallery(items: GalleryItem[], filter: GalleryFilter): GalleryItem[] {
  if (filter === "all") return items.slice();
  return items.filter((i) => i.media_type === filter);
}

export function sortGallery(items: GalleryItem[], sort: GallerySort): GalleryItem[] {
  const list = items.slice();
  switch (sort) {
    case "newest":
      // Stable tie-breaker: identical timestamps fall back to the manual order.
      return list.sort((a, b) => time(b.created_at) - time(a.created_at) || manualRank(a, b));
    case "oldest":
      return list.sort((a, b) => time(a.created_at) - time(b.created_at) || manualRank(a, b));
    case "popular":
      return list.sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0) || manualRank(a, b));
    case "manual":
    default:
      return list.sort(manualRank);
  }
}

export const filterAndSortGallery = (
  items: GalleryItem[],
  filter: GalleryFilter,
  sort: GallerySort,
): GalleryItem[] => sortGallery(filterGallery(items, filter), sort);
