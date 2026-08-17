/**
 * Site-content keys whose value is the same across every locale.
 *
 * The dashboard stores their value in `value_es` regardless of which language
 * tab is active, and useSiteContent serves `value_es` for these keys on every
 * public page. For all other (locale-dependent) keys, useSiteContent returns
 * the active locale's value or an empty string — letting consumers fall back
 * to the static i18n translation via the `sc.foo || t.bar.foo` pattern.
 *
 * Categories that belong here:
 *  - Technical configs (robots.txt, sitemap config)
 *  - Numbers used in JSON-LD (ratings, review counts)
 *  - URLs, social handles, phone numbers — single value, never translated
 *  - All `integration_*` keys (GA4 ID, GSC verification, GTM ID, …)
 *
 * Adding a new locale-independent key here propagates to both the dashboard
 * editor and the public-site hook in one shot.
 */
export const LOCALE_INDEPENDENT_KEYS: ReadonlySet<string> = new Set([
  // robots.txt is NOT editable from the dashboard: public/robots.txt is the
  // single source of truth, shipped with the frontend build.

  "sitemap_config",
  "google_rating",
  "google_review_count",
  "contact_whatsapp",
  "contact_instagram",
  "contact_facebook_url",
  "contact_google_url",
  "contact_tripadvisor_url",
]);

export const isLocaleIndependentKey = (key: string): boolean =>
  LOCALE_INDEPENDENT_KEYS.has(key) || key.startsWith("integration_");
