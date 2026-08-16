import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";

export interface PageImage {
  src: string;
  alt: string;
}

interface PageImageRow {
  image_url: string;
  alt_text: string | null;
  sort_order: number;
}

/**
 * Fetches custom carousel images for a given collection (e.g. "home_carousel").
 * `loaded` is false until the request resolves so callers can keep their
 * built-in defaults instead of swapping images mid-load.
 */
export const usePageImages = (collectionKey: string): { images: PageImage[]; loaded: boolean } => {
  const { data, isFetched } = useQuery({
    queryKey: queryKeys.pageImages(collectionKey),
    queryFn: async (): Promise<PageImage[]> => {
      const { data, error } = await supabase
        .from("page_images")
        .select("image_url, alt_text, sort_order")
        .eq("collection_key", collectionKey)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r: PageImageRow) => ({
        src: r.image_url,
        alt: r.alt_text ?? "",
      }));
    },
  });
  return { images: data ?? [], loaded: isFetched };
};

