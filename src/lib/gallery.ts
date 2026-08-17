import { supabase } from "@/integrations/supabase/client";
import { BASE_URL, ROUTE_MAP } from "@/config/routes";
import type { Locale } from "@/i18n/types";
import { extOf, VIDEO_INPUT_EXTS } from "@/lib/media-kind";

export type GalleryMediaType = "photo" | "video";

export interface GalleryItem {
  id: string;
  media_type: GalleryMediaType;
  media_url: string;
  poster_url: string;
  title_es: string;
  title_en: string;
  title_ru: string;
  description_es: string;
  description_en: string;
  description_ru: string;
  alt_es: string;
  alt_en: string;
  alt_ru: string;
  sort_order: number;
  published: boolean;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
}

export const GALLERY_COLUMNS =
  "id, media_type, media_url, poster_url, title_es, title_en, title_ru, description_es, description_en, description_ru, alt_es, alt_en, alt_ru, sort_order, published, duration_seconds, created_at, updated_at";

/**
 * The gallery table ships with the app but its migration is applied separately, so a
 * missing table must degrade to "no items" instead of surfacing a load error.
 */
export const isMissingGalleryTable = (error: { code?: string; message?: string } | null) =>
  !!error &&
  (error.code === "42P01" ||
    error.code === "PGRST205" ||
    /does not exist|find the table/i.test(error.message ?? ""));

/** Untyped accessor — `gallery_items` is not in the generated Supabase types yet. */
export const galleryTable = () =>
  (supabase as unknown as { from: (t: string) => any }).from("gallery_items");

const suffix = (locale: Locale) => (locale === "es" ? "es" : locale);

/** Localized field with a Spanish fallback so a page never renders an empty caption. */
export function pickLocalized(
  item: Partial<GalleryItem>,
  field: "title" | "description" | "alt",
  locale: Locale,
): string {
  const localized = (item as Record<string, unknown>)[`${field}_${suffix(locale)}`];
  const es = (item as Record<string, unknown>)[`${field}_es`];
  return (typeof localized === "string" && localized.trim() ? localized : (es as string) || "").trim();
}

export const isVideoUrl = (url: string) =>
  (VIDEO_INPUT_EXTS as readonly string[]).includes(extOf(url.split("?")[0]));

/** Grid thumbnail: videos always show their static poster, never an active <video>. */
export const thumbnailFor = (item: GalleryItem) =>
  item.media_type === "video" ? item.poster_url || "" : item.media_url;

/** ISO-8601 duration (PT1M30S) for schema.org VideoObject. */
export function isoDuration(seconds: number | null | undefined): string | undefined {
  if (!seconds || seconds <= 0 || !Number.isFinite(seconds)) return undefined;
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `PT${m > 0 ? `${m}M` : ""}${s}S`;
}

/** schema.org ImageGallery with ImageObject / VideoObject members. */
export function buildGallerySchema(items: GalleryItem[], locale: Locale) {
  const url = `${BASE_URL}${ROUTE_MAP.gallery[locale]}`;
  return {
    "@type": "ImageGallery",
    "@id": `${url}#gallery`,
    url,
    inLanguage: locale === "es" ? "es-ES" : locale === "ru" ? "ru-RU" : "en-US",
    hasPart: items.map((item) => {
      const name = pickLocalized(item, "title", locale) || pickLocalized(item, "alt", locale);
      const description = pickLocalized(item, "description", locale);
      if (item.media_type === "video") {
        const duration = isoDuration(item.duration_seconds);
        return {
          "@type": "VideoObject",
          name: name || "Elias Masaje",
          ...(description ? { description } : {}),
          contentUrl: item.media_url,
          thumbnailUrl: item.poster_url || undefined,
          uploadDate: item.created_at,
          ...(duration ? { duration } : {}),
        };
      }
      return {
        "@type": "ImageObject",
        contentUrl: item.media_url,
        thumbnailUrl: item.media_url,
        ...(name ? { name } : {}),
        ...(description ? { description } : {}),
        ...(pickLocalized(item, "alt", locale) ? { caption: pickLocalized(item, "alt", locale) } : {}),
        uploadDate: item.created_at,
      };
    }),
  };
}
