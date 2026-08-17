/**
 * Shared helpers for localized image alt text.
 *
 * Carousels (page_images) keep the Spanish alt in `alt_text` and add
 * `alt_text_en` / `alt_text_ru`. Blog images store their alt inside the
 * localized HTML itself, so one image can carry a different alt per language.
 */

export type AltLang = "es" | "en" | "ru";

/** Google/WCAG practice: a short sentence, not a keyword list. */
export const MAX_ALT_LENGTH = 125;

/** Marks an image as purely decorative so alt="" is intentional, not a gap. */
export const DECORATIVE_ATTR = "data-decorative";

export interface AltRow {
  alt_text?: string | null;
  alt_text_en?: string | null;
  alt_text_ru?: string | null;
}

export const altColumn = (lang: AltLang): "alt_text" | "alt_text_en" | "alt_text_ru" =>
  lang === "es" ? "alt_text" : lang === "en" ? "alt_text_en" : "alt_text_ru";

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Active locale → Spanish base → empty string (never the file name). */
export function pickAlt(row: AltRow, locale: string): string {
  const lang: AltLang = locale === "en" ? "en" : locale === "ru" ? "ru" : "es";
  const active = clean(row[altColumn(lang)]);
  if (active) return active;
  return clean(row.alt_text);
}

/** Which languages already have an alt written for this row. */
export function altStatus(row: AltRow): Record<AltLang, boolean> {
  return {
    es: !!clean(row.alt_text),
    en: !!clean(row.alt_text_en),
    ru: !!clean(row.alt_text_ru),
  };
}

export type AltError = "empty" | "tooLong" | null;

/** Decorative images may be empty; informative ones must say something short. */
export function validateAlt(alt: string, decorative: boolean): AltError {
  if (decorative) return null;
  if (!alt.trim()) return "empty";
  if (alt.trim().length > MAX_ALT_LENGTH) return "tooLong";
  return null;
}

export interface ParsedImage {
  src: string;
  alt: string;
  decorative: boolean;
}

const IMG_RE = /<img\b[^>]*>/gi;
const attr = (tag: string, name: string): string | null => {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  if (!m) return null;
  return m[2] ?? m[3] ?? "";
};

/** Regex-based so it works identically in the browser, in tests and on HTML strings. */
export function parseImages(html: string): ParsedImage[] {
  if (!html) return [];
  return (html.match(IMG_RE) ?? []).map((tag) => ({
    src: attr(tag, "src") ?? "",
    alt: attr(tag, "alt") ?? "",
    decorative: (attr(tag, DECORATIVE_ATTR) ?? "").toLowerCase() === "true",
  }));
}

/** Informative images with no alt at all — decorative ones are not a problem. */
export function countMissingAlt(html: string): number {
  return parseImages(html).filter((i) => !i.decorative && !i.alt.trim()).length;
}

/**
 * Images in a translated version whose alt is byte-identical to the source
 * language — i.e. the alt was carried over instead of translated.
 */
export function countNonLocalizedAlt(sourceHtml: string, targetHtml: string): number {
  const source = new Map(parseImages(sourceHtml).map((i) => [i.src, i]));
  return parseImages(targetHtml).filter((i) => {
    if (i.decorative || !i.alt.trim()) return false;
    const src = source.get(i.src);
    return !!src && src.alt.trim() === i.alt.trim();
  }).length;
}
