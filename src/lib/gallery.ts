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
  /** Non-destructive thumbnail framing (see @/lib/gallery-crop). */
  thumbnail_x: number;
  thumbnail_y: number;
  thumbnail_zoom: number;
  created_at: string;
  updated_at: string;
}

export const GALLERY_COLUMNS =
  "id, media_type, media_url, poster_url, title_es, title_en, title_ru, description_es, description_en, description_ru, alt_es, alt_en, alt_ru, sort_order, published, duration_seconds, thumbnail_x, thumbnail_y, thumbnail_zoom, created_at, updated_at";

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

/**
 * Containers browsers can be relied on to play inline. MOV/M4V are accepted by the
 * Library (and by the local converter) but must not be published to the public grid.
 */
export const WEB_PLAYABLE_VIDEO_EXTS = ["mp4", "webm"] as const;

export const isWebPlayableVideo = (url: string) =>
  (WEB_PLAYABLE_VIDEO_EXTS as readonly string[]).includes(extOf(url.split("?")[0]));

/* ------------------------------------------------------------------ *
 * Grid thumbnails
 *
 * The public grid must never download the full-size original. Supabase Storage
 * serves on-the-fly derivatives from /storage/v1/render/image/public/<bucket>/…,
 * so the grid points at a bounded transform of the same object (no duplicate
 * stored copy). Anything that is not a public image object in our own media
 * bucket falls back to the untouched URL.
 * ------------------------------------------------------------------ */

/** Bounded, non-negotiable derivative parameters — never taken from user input. */
export const THUMB_WIDTH = 800;
export const THUMB_QUALITY = 70;
export const THUMB_RESIZE = "cover" as const;
const MAX_THUMB_WIDTH = 1600;
const MIN_THUMB_WIDTH = 80;

const PUBLIC_OBJECT_SEGMENT = "/storage/v1/object/public/";
const RENDER_IMAGE_SEGMENT = "/storage/v1/render/image/public/";
const MEDIA_BUCKET = "media";
/** Formats the image renderer can actually re-encode (GIF/SVG are passed through). */
const TRANSFORMABLE_EXTS = ["jpg", "jpeg", "png", "webp", "avif"] as const;

const clampWidth = (w: number) =>
  Math.min(MAX_THUMB_WIDTH, Math.max(MIN_THUMB_WIDTH, Math.round(w) || THUMB_WIDTH));

const clampQuality = (q: number) => Math.min(100, Math.max(20, Math.round(q) || THUMB_QUALITY));

/**
 * Origin of the Supabase project this build talks to. A look-alike path on a foreign
 * host (https://evil.example/storage/v1/object/public/media/x.webp) must never be
 * rewritten into "our" renderer, so the origin is compared, not just the path.
 */
const projectOrigin = (): string | null => {
  const raw = (import.meta.env?.VITE_SUPABASE_URL ?? "") as string;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
};

/**
 * Public image URL in our media bucket → bounded render/image derivative.
 * Returns `null` for anything else (foreign origin, malformed encoding, traversal,
 * non-transformable format) so callers keep using the original URL. Never throws.
 */
export function storageThumbUrl(
  rawUrl: string,
  opts: { width?: number; quality?: number } = {},
): string | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  const origin = projectOrigin();
  if (!origin || parsed.origin !== origin) return null;
  const idx = parsed.pathname.indexOf(PUBLIC_OBJECT_SEGMENT);
  if (idx !== 0) return null;

  const rest = parsed.pathname.slice(PUBLIC_OBJECT_SEGMENT.length);
  const slash = rest.indexOf("/");
  if (slash <= 0) return null;
  const bucket = rest.slice(0, slash);
  const objectPath = rest.slice(slash + 1);
  if (bucket !== MEDIA_BUCKET || !objectPath) return null;
  if (objectPath.includes("..")) return null;

  // Malformed percent-encoding (%zz, lone %) must degrade to "no derivative", not throw.
  let decoded: string;
  try {
    decoded = decodeURIComponent(objectPath);
  } catch {
    return null;
  }
  // Encoded traversal (%2e%2e%2f) and encoded path separators are refused as well.
  if (decoded.includes("..") || decoded.includes("/")) return null;
  if (!(TRANSFORMABLE_EXTS as readonly string[]).includes(extOf(decoded))) return null;

  // Re-assemble through URL so every segment stays correctly percent-encoded.
  const out = new URL(parsed.origin);
  out.pathname = `${RENDER_IMAGE_SEGMENT}${bucket}/${objectPath}`;
  out.searchParams.set("width", String(clampWidth(opts.width ?? THUMB_WIDTH)));
  out.searchParams.set("quality", String(clampQuality(opts.quality ?? THUMB_QUALITY)));
  out.searchParams.set("resize", THUMB_RESIZE);
  return out.toString();
}


/** Full-size asset shown in the lightbox (photo) or played (video). */
export const originalFor = (item: GalleryItem) =>
  item.media_type === "video" ? item.poster_url || "" : item.media_url;

/**
 * Grid thumbnail: videos always show their static poster, never an active <video>.
 * Photos and posters are served as a bounded derivative when the object lives in
 * our media bucket; the raw URL is only a fallback (also used by <img onError>).
 */
export const thumbnailFor = (item: GalleryItem) => {
  const source = originalFor(item);
  if (!source) return "";
  return storageThumbUrl(source) ?? source;
};

/* ------------------------------------------------------------------ *
 * Publish validation
 * ------------------------------------------------------------------ */

export type GalleryPublishIssue = "missingMedia" | "missingPoster" | "notWebPlayable";

/** Reasons an item may not be published. Empty array = safe to publish. */
export function publishIssues(item: Pick<GalleryItem, "media_type" | "media_url" | "poster_url">): GalleryPublishIssue[] {
  const issues: GalleryPublishIssue[] = [];
  if (!item.media_url || !item.media_url.trim()) issues.push("missingMedia");
  if (item.media_type === "video") {
    // A VideoObject without a thumbnailUrl is invalid structured data, so a video
    // without a cover image simply cannot go public.
    if (!item.poster_url || !item.poster_url.trim()) issues.push("missingPoster");
    if (item.media_url && !isWebPlayableVideo(item.media_url)) issues.push("notWebPlayable");
  }
  return issues;
}

export const canPublish = (item: Pick<GalleryItem, "media_type" | "media_url" | "poster_url">) =>
  publishIssues(item).length === 0;


/** ISO-8601 duration (PT1M30S) for schema.org VideoObject. */
export function isoDuration(seconds: number | null | undefined): string | undefined {
  if (!seconds || seconds <= 0 || !Number.isFinite(seconds)) return undefined;
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `PT${m > 0 ? `${m}M` : ""}${s}S`;
}

/**
 * schema.org ImageGallery with ImageObject / VideoObject members.
 *
 * A VideoObject is only emitted when every required property (name, thumbnailUrl,
 * contentUrl, uploadDate) is actually present — an incomplete node is dropped rather
 * than published. `duration` is included only when the real length is known.
 */
export function buildGallerySchema(items: GalleryItem[], locale: Locale) {
  const url = `${BASE_URL}${ROUTE_MAP.gallery[locale]}`;
  const hasPart = items
    .map((item) => {
      const name = pickLocalized(item, "title", locale) || pickLocalized(item, "alt", locale);
      const description = pickLocalized(item, "description", locale);
      if (item.media_type === "video") {
        const thumbnailUrl = (item.poster_url || "").trim();
        const contentUrl = (item.media_url || "").trim();
        const uploadDate = (item.created_at || "").trim();
        const videoName = name || pickLocalized(item, "alt", locale);
        if (!thumbnailUrl || !contentUrl || !uploadDate || !videoName) return null;
        const duration = isoDuration(item.duration_seconds);
        return {
          "@type": "VideoObject",
          name: videoName,
          ...(description ? { description } : {}),
          contentUrl,
          thumbnailUrl,
          uploadDate,
          ...(duration ? { duration } : {}),
        };
      }
      const contentUrl = (item.media_url || "").trim();
      if (!contentUrl) return null;
      const caption = pickLocalized(item, "alt", locale);
      return {
        "@type": "ImageObject",
        contentUrl,
        thumbnailUrl: storageThumbUrl(contentUrl) ?? contentUrl,
        ...(name ? { name } : {}),
        ...(description ? { description } : {}),
        ...(caption ? { caption } : {}),
        uploadDate: item.created_at,
      };
    })
    .filter((n): n is NonNullable<typeof n> => n !== null);

  return {
    "@type": "ImageGallery",
    "@id": `${url}#gallery`,
    url,
    inLanguage: locale === "es" ? "es-ES" : locale === "ru" ? "ru-RU" : "en-US",
    hasPart,
  };

}
