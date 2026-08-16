import { Locale } from "@/i18n/types";
import { BASE_URL, ROUTE_MAP } from "@/config/routes";

export type LocalizedSlugField = "slug_es" | "slug_en" | "slug_ru";

export interface LocalizedSlugRow {
  id?: string;
  slug?: string | null;
  slug_es?: string | null;
  slug_en?: string | null;
  slug_ru?: string | null;
}

export const LOCALES: Locale[] = ["es", "en", "ru"];

/** Column that holds the slug for a given locale. */
export const slugField = (locale: Locale): LocalizedSlugField =>
  locale === "es" ? "slug_es" : locale === "en" ? "slug_en" : "slug_ru";

const clean = (value: string | null | undefined) => (value ?? "").trim();

/**
 * Slug to use in URLs for `locale`.
 * Falls back to the untouched legacy slug (and finally the id) so rows whose
 * localized columns are still null keep working during the staged rollout.
 */
export const localizedSlug = (post: LocalizedSlugRow, locale: Locale): string =>
  clean(post[slugField(locale)]) || clean(post.slug) || clean(post.id);

/** Absolute URL of an article in a given locale. */
export const localizedPostUrl = (post: LocalizedSlugRow, locale: Locale): string =>
  `${BASE_URL}${ROUTE_MAP.blog[locale]}/${localizedSlug(post, locale)}`;

/** Reciprocal hreflang alternates (es, en, ru + Spanish x-default). */
export const localizedPostAlternates = (post: LocalizedSlugRow) => [
  ...LOCALES.map((loc) => ({ hreflang: loc as string, href: localizedPostUrl(post, loc) })),
  { hreflang: "x-default", href: localizedPostUrl(post, "es") },
];

/** Lowercase ASCII + hyphen slug. Non-ASCII characters are dropped. */
export const slugify = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");

export const isValidSlug = (value: string): boolean => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value);
