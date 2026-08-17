import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { GALLERY_COLUMNS, galleryTable, isMissingGalleryTable, type GalleryItem } from "@/lib/gallery";

/** Published gallery items in display order (public site). */
export function useGallery() {
  return useQuery({
    queryKey: queryKeys.gallery,
    queryFn: async (): Promise<GalleryItem[]> => {
      const { data, error } = await galleryTable()
        .select(GALLERY_COLUMNS)
        .eq("published", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) {
        if (isMissingGalleryTable(error)) return [];
        throw error;
      }
      return (data ?? []) as GalleryItem[];
    },
  });
}

/** All items, published or not — dashboard only (RLS restricts this to admins). */
export function useGalleryAdmin() {
  return useQuery({
    queryKey: queryKeys.galleryAdmin,
    queryFn: async (): Promise<GalleryItem[]> => {
      const { data, error } = await galleryTable()
        .select(GALLERY_COLUMNS)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) {
        if (isMissingGalleryTable(error)) return [];
        throw error;
      }
      return (data ?? []) as GalleryItem[];
    },
  });
}
