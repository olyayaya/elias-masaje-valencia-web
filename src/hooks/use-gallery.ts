import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { GALLERY_COLUMNS, galleryTable, isMissingGalleryTable, type GalleryItem } from "@/lib/gallery";

/**
 * The gallery table ships ahead of its migration, so "table not there yet" is an
 * expected state — not a failure. Both hooks resolve successfully with an empty
 * list (no global error toast) and expose `missingTable` so the Dashboard can show
 * its own explanatory notice while the public page just renders its empty state.
 */
export interface GalleryQueryResult {
  items: GalleryItem[];
  missingTable: boolean;
}

const EMPTY: GalleryItem[] = [];

async function loadGallery(publishedOnly: boolean): Promise<GalleryQueryResult> {
  let query = galleryTable().select(GALLERY_COLUMNS);
  if (publishedOnly) query = query.eq("published", true);
  const { data, error } = await query
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    if (isMissingGalleryTable(error)) return { items: EMPTY, missingTable: true };
    throw error;
  }
  return { items: (data ?? []) as GalleryItem[], missingTable: false };
}

/** Published gallery items in display order (public site). */
export function useGallery() {
  const query = useQuery({
    queryKey: queryKeys.gallery,
    queryFn: () => loadGallery(true),
  });
  return {
    ...query,
    data: query.data?.items ?? EMPTY,
    missingTable: query.data?.missingTable ?? false,
  };
}

/** All items, published or not — dashboard only (RLS restricts this to admins). */
export function useGalleryAdmin() {
  const query = useQuery({
    queryKey: queryKeys.galleryAdmin,
    queryFn: () => loadGallery(false),
  });
  return {
    ...query,
    data: query.data?.items ?? EMPTY,
    missingTable: query.data?.missingTable ?? false,
  };
}
