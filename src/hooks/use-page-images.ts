import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import { useI18n } from "@/i18n/context";
import { pickAlt } from "@/lib/alt-text";

export interface PageImage {
  src: string;
  alt: string;
}

interface PageImageRow {
  image_url: string;
  alt_text: string | null;
  alt_text_en: string | null;
  alt_text_ru: string | null;
  sort_order: number;
}

/**
 * Fetches custom carousel images for a given collection (e.g. "home_carousel").
 * `loaded` is false until the request resolves so callers can keep their
 * built-in defaults instead of swapping images mid-load.
 *
 * Alt text is resolved for the active locale with a Spanish fallback, so the
 * rendered <img alt="..."> always matches the language the visitor is reading.
 */
export const usePageImages = (collectionKey: string): { images: PageImage[]; loaded: boolean } => {
  const { locale } = useI18n();
  const { data, isFetched } = useQuery({
    queryKey: queryKeys.pageImages(collectionKey),
    queryFn: async (): Promise<PageImageRow[]> => {
      const { data, error } = await supabase
        .from("page_images")
        .select("image_url, alt_text, alt_text_en, alt_text_ru, sort_order")
        .eq("collection_key", collectionKey)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PageImageRow[];
    },
  });

  const images = useMemo(
    () => (data ?? []).map((r) => ({ src: r.image_url, alt: pickAlt(r, locale) })),
    [data, locale],
  );

  return { images, loaded: isFetched };
};
