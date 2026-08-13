/**
 * Canonical URL normalization.
 *
 * The site is served as a static SPA, so true server-side 301s aren't
 * available on hosting. Instead we normalize at the edge of the client:
 * a `location.replace()` (no extra history entry) plus the `<link rel=canonical>`
 * emitted by `useHead`, which is what search engines consolidate on.
 *
 * Rules (applied in order):
 *  1. http -> https (except localhost / private dev hosts)
 *  2. strip trailing slash (except the root "/")
 *  3. lowercase the ASCII letters of the pathname (query + hash untouched)
 *  4. collapse duplicate slashes
 */

const DEV_HOSTS = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/i;

/** Lowercase only ASCII A-Z so percent-escapes (e.g. Cyrillic slugs) stay valid. */
const lowerAscii = (value: string) => value.replace(/[A-Z]+/g, (m) => m.toLowerCase());

export const normalizePathname = (pathname: string): string => {
  let next = lowerAscii(pathname).replace(/\/{2,}/g, "/");
  if (next.length > 1) next = next.replace(/\/+$/, "");
  return next === "" ? "/" : next;
};

/**
 * Returns the canonical absolute URL for `href`, or `null` when it's already canonical.
 */
export const getCanonicalRedirect = (href: string): string | null => {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }

  const isDev = DEV_HOSTS.test(url.hostname);
  if (url.protocol === "http:" && !isDev) url.protocol = "https:";

  url.pathname = normalizePathname(url.pathname);

  const canonical = url.toString();
  return canonical === href ? null : canonical;
};

/** Full-page canonical redirect. Runs before React mounts. */
export const enforceCanonicalUrl = () => {
  if (typeof window === "undefined") return;
  const target = getCanonicalRedirect(window.location.href);
  if (target) window.location.replace(target);
};
