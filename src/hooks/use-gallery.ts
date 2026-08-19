import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  GALLERY_COLUMNS, GALLERY_COUNTER_COLUMNS, galleryTable, isMissingGalleryColumn,
  isMissingGalleryTable, type GalleryItem,
} from "@/lib/gallery";

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

async function runQuery(columns: string, publishedOnly: boolean) {
  let query = galleryTable().select(columns);
  if (publishedOnly) query = query.eq("published", true);
  return query.order("sort_order", { ascending: true }).order("created_at", { ascending: true });
}

async function loadGallery(publishedOnly: boolean): Promise<GalleryQueryResult> {
  // The engagement counters ship with a migration applied separately, so a database
  // without them must still render the gallery — it just sorts without view counts.
  let { data, error } = await runQuery(`${GALLERY_COLUMNS}, ${GALLERY_COUNTER_COLUMNS}`, publishedOnly);
  if (error && isMissingGalleryColumn(error)) {
    ({ data, error } = await runQuery(GALLERY_COLUMNS, publishedOnly));
  }
  if (error) {
    if (isMissingGalleryTable(error)) return { items: EMPTY, missingTable: true };
    throw error;
  }
  return { items: (data ?? []) as unknown as GalleryItem[], missingTable: false };
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
