import { Locale } from "@/i18n/types";

export type PageId = "home" | "services" | "about" | "contact" | "blog" | "blogPost";

export const BASE_URL = "https://eliasmas.es";

export const ROUTE_MAP: Record<PageId, Record<Locale, string>> = {
  home:     { es: "/",          en: "/en",            ru: "/ru" },
  services: { es: "/servicios", en: "/en/services",   ru: "/ru/uslugi" },
  about:    { es: "/sobre-mi",  en: "/en/about",      ru: "/ru/about" },
  contact:  { es: "/contacto",  en: "/en/contact",    ru: "/ru/contact" },
  blog:     { es: "/blog",      en: "/en/blog",       ru: "/ru/blog" },
  blogPost: { es: "/blog/:slug", en: "/en/blog/:slug", ru: "/ru/blog/:slug" },
};

export function getLocaleFromPath(pathname: string): Locale {
  if (pathname.startsWith("/en")) return "en";
  if (pathname.startsWith("/ru")) return "ru";
  return "es";
}

export function getCurrentPageId(pathname: string): PageId | null {
  for (const [pageId, paths] of Object.entries(ROUTE_MAP)) {
    for (const [, path] of Object.entries(paths)) {
      const pattern = "^" + path.replace(":slug", "[^/]+") + "$";
      if (new RegExp(pattern).test(pathname)) return pageId as PageId;
    }
  }
  return null;
}

export function getEquivalentPath(currentPath: string, targetLocale: Locale): string {
  const pageId = getCurrentPageId(currentPath);
  if (!pageId) return targetLocale === "es" ? "/" : `/${targetLocale}`;

  const targetPath = ROUTE_MAP[pageId][targetLocale];

  if (pageId === "blogPost") {
    const slug = currentPath.split("/").pop();
    return targetPath.replace(":slug", slug || "");
  }

  return targetPath;
}

/** Returns hreflang alternate links for a page */
export function getAlternates(pageId: PageId, params?: Record<string, string>) {
  const locales: Locale[] = ["es", "en", "ru"];

  return [
    ...locales.map((loc) => {
      let path = ROUTE_MAP[pageId][loc];
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          path = path.replace(`:${key}`, value);
        });
      }
      return { hreflang: loc, href: `${BASE_URL}${path}` };
    }),
    { hreflang: "x-default", href: `${BASE_URL}${ROUTE_MAP[pageId].es}` },
  ];
}
