import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PageImage {
  src: string;
  alt: string;
}

/**
 * Fetches custom carousel images for a given collection (e.g. "home_carousel").
 * Returns the custom list if any exist, otherwise an empty array — callers should
 * fall back to their built-in defaults.
 */
export const usePageImages = (collectionKey: string): PageImage[] => {
  const [images, setImages] = useState<PageImage[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("page_images")
        .select("image_url, alt_text, sort_order")
        .eq("collection_key", collectionKey)
        .order("sort_order", { ascending: true });
      if (!cancelled && data) {
        setImages(data.map((r: any) => ({ src: r.image_url, alt: r.alt_text || "" })));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [collectionKey]);

  return images;
};
