import { useEffect, useRef } from "react";
import { BASE_URL } from "@/config/routes";
import { normalizePathname } from "@/lib/canonical-url";

/** Absolute 1200x630 social preview used when a page has no specific image. */
export const DEFAULT_OG_IMAGE = "https://eliasmas.es/og-image.jpg";

const OG_LOCALE: Record<string, string> = { es: "es_ES", en: "en_US", ru: "ru_RU" };

/** Crawlers need absolute https URLs; relative paths are resolved against BASE_URL. */
function toAbsolute(url?: string) {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

interface HeadProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogType?: string;
  /** Canonical page URL for og:url — defaults to `canonical`. */
  ogUrl?: string;
  /** Absolute or root-relative preview image (1200x630 recommended). */
  ogImage?: string;
  ogImageAlt?: string;
  /** Page language, used for og:locale. */
  locale?: string;
  jsonLd?: Record<string, any>;
  alternates?: { hreflang: string; href: string }[];
  /** e.g. "noindex, follow" for utility pages that shouldn't be indexed. */
  robots?: string;
  /** Private pages (login, dashboard): skip all Open Graph / Twitter tags. */
  noSocial?: boolean;
  /** Extra article:* Open Graph tags for editorial pages. */
  article?: {
    publishedTime?: string;
    modifiedTime?: string;
    author?: string;
    section?: string;
    tags?: string[];
  };
}


/**
 * Manages document head elements (title, meta, canonical, hreflang, JSON-LD).
 * Safe to call unconditionally — undefined values are skipped.
 * Cleans up on unmount.
 */
export function useHead(props: HeadProps) {
  const jsonLdStr = props.jsonLd ? JSON.stringify(props.jsonLd) : "";
  const alternatesStr = props.alternates ? JSON.stringify(props.alternates) : "";
  const articleStr = props.article ? JSON.stringify(props.article) : "";

  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const { title, description, canonical, ogTitle, ogDescription, ogType, ogUrl, ogImage, ogImageAlt, locale, alternates, robots, article, noSocial } =
      propsRef.current;

    const prevTitle = document.title;
    const created: Element[] = [];

    if (title) document.title = title;

    const setMeta = (attr: string, val: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${val}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, val);
        document.head.appendChild(el);
        created.push(el);
      }
      el.setAttribute("content", content);
    };

    if (description) setMeta("name", "description", description);
    if (!noSocial) {
      if (ogTitle) setMeta("property", "og:title", ogTitle);
      if (ogDescription) setMeta("property", "og:description", ogDescription);
      if (ogType) setMeta("property", "og:type", ogType);

      const socialTitle = ogTitle || title;
      const socialDesc = ogDescription || description;
      const socialUrl = toAbsolute(ogUrl || canonical);
      const socialImage = toAbsolute(ogImage) || DEFAULT_OG_IMAGE;

      setMeta("property", "og:site_name", "Elias Masaje");
      if (locale) setMeta("property", "og:locale", OG_LOCALE[locale] || "es_ES");
      if (socialUrl) setMeta("property", "og:url", socialUrl);
      setMeta("property", "og:image", socialImage);
      setMeta("property", "og:image:secure_url", socialImage);
      setMeta(
        "property",
        "og:image:type",
        /\.png(\?|$)/i.test(socialImage) ? "image/png" : /\.webp(\?|$)/i.test(socialImage) ? "image/webp" : "image/jpeg",
      );
      // Only advertise dimensions for the known 1200x630 default asset.
      if (socialImage === DEFAULT_OG_IMAGE) {
        setMeta("property", "og:image:width", "1200");
        setMeta("property", "og:image:height", "630");
      }
      setMeta("property", "og:image:alt", ogImageAlt || socialTitle || "Elias Masaje");

      setMeta("name", "twitter:card", "summary_large_image");
      if (socialTitle) setMeta("name", "twitter:title", socialTitle);
      if (socialDesc) setMeta("name", "twitter:description", socialDesc);
      setMeta("name", "twitter:image", socialImage);
      setMeta("name", "twitter:image:alt", ogImageAlt || socialTitle || "Elias Masaje");
    }

    if (robots) setMeta("name", "robots", robots);

    if (article) {
      if (article.publishedTime) setMeta("property", "article:published_time", article.publishedTime);
      if (article.modifiedTime) setMeta("property", "article:modified_time", article.modifiedTime);
      if (article.author) setMeta("property", "article:author", article.author);
      if (article.section) setMeta("property", "article:section", article.section);
      article.tags?.slice(0, 6).forEach((tag) => {
        const el = document.createElement("meta");
        el.setAttribute("property", "article:tag");
        el.setAttribute("content", tag);
        document.head.appendChild(el);
        created.push(el);
      });
    }


    // Canonical: always self-referencing. Falls back to the current URL
    // (origin + normalized pathname, no query/hash) so no page inherits a
    // stale canonical from a previously rendered route.
    let linkEl: HTMLLinkElement | null = null;
    {
      const href = canonical || `${window.location.origin}${normalizePathname(window.location.pathname)}`;
      linkEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!linkEl) {
        linkEl = document.createElement("link");
        linkEl.setAttribute("rel", "canonical");
        document.head.appendChild(linkEl);
        created.push(linkEl);
      }
      linkEl.setAttribute("href", href);
    }


    // hreflang alternate links
    if (alternates?.length) {
      document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());
      alternates.forEach(({ hreflang, href }) => {
        const el = document.createElement("link");
        el.setAttribute("rel", "alternate");
        el.setAttribute("hreflang", hreflang);
        el.setAttribute("href", href);
        document.head.appendChild(el);
        created.push(el);
      });
    }

    if (jsonLdStr) {
      let scriptEl = document.getElementById("app-jsonld") as HTMLScriptElement | null;
      if (!scriptEl) {
        scriptEl = document.createElement("script");
        scriptEl.id = "app-jsonld";
        scriptEl.type = "application/ld+json";
        document.head.appendChild(scriptEl);
        created.push(scriptEl);
      }
      scriptEl.textContent = jsonLdStr;
    }

    return () => {
      document.title = prevTitle;
      created.forEach((el) => el.remove());
    };
  }, [
    propsRef.current.title,
    propsRef.current.description,
    propsRef.current.canonical,
    propsRef.current.ogTitle,
    propsRef.current.ogDescription,
    propsRef.current.ogType,
    propsRef.current.ogUrl,
    propsRef.current.ogImage,
    propsRef.current.ogImageAlt,
    propsRef.current.locale,
    propsRef.current.robots,
    articleStr,
    jsonLdStr,
    alternatesStr,
  ]);

}
