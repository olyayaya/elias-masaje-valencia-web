/**
 * Cloudflare Worker: transparent reverse proxy for https://eliasmas.es/sitemap.xml
 *
 * It contains NO URL list and generates nothing — the single sitemap generator
 * is the Supabase Edge Function below. All other paths are passed through to
 * the normal Lovable origin.
 */

export const UPSTREAM = "https://ukjljyrejfkyurebksqz.supabase.co/functions/v1/sitemap";
export const PROXIED_PATH = "/sitemap.xml";
const MAX_AGE_SECONDS = 60;

export default {
  /**
   * @param {Request} request
   */
  async fetch(request) {
    const url = new URL(request.url);

    // Never intercept anything but the canonical sitemap path.
    if (url.pathname !== PROXIED_PATH) {
      return fetch(request);
    }

    const upstream = await fetch(UPSTREAM, {
      method: "GET",
      headers: { Accept: "application/xml" },
      redirect: "follow",
    });

    // Always serve XML, never mirror an upstream content type such as
    // text/plain (the Supabase gateway has been observed rewriting it).
    const headers = new Headers();
    headers.set("Content-Type", "application/xml; charset=utf-8");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set(
      "Cache-Control",
      upstream.ok ? `public, max-age=${MAX_AGE_SECONDS}, s-maxage=${MAX_AGE_SECONDS}` : "no-store",
    );
    headers.set("X-Sitemap-Proxy", "cloudflare-worker");

    return new Response(upstream.body, { status: upstream.status, headers });
  },
};
