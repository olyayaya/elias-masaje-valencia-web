import { BASE_URL, ROUTE_MAP, PageId } from "@/config/routes";
import { Locale } from "@/i18n/types";

/** Localized breadcrumb labels for the key public pages. */
const LABELS: Record<Exclude<PageId, "blogPost">, Record<Locale, string>> = {
  home: { es: "Inicio", en: "Home", ru: "Главная" },
  services: { es: "Servicios", en: "Services", ru: "Услуги" },
  gallery: { es: "Galería", en: "Gallery", ru: "Галерея" },
  about: { es: "Sobre mí", en: "About", ru: "Обо мне" },
  contact: { es: "Contacto", en: "Contact", ru: "Контакты" },
  blog: { es: "Blog", en: "Blog", ru: "Блог" },
  privacy: { es: "Privacidad", en: "Privacy", ru: "Конфиденциальность" },
};

export interface BreadcrumbCrumb {
  name: string;
  url: string;
}

/**
 * Builds a schema.org BreadcrumbList node for a page, always rooted at Home.
 * Extra crumbs (e.g. a blog post title) can be appended via `extra`.
 */
export function buildBreadcrumbList(
  pageId: Exclude<PageId, "blogPost">,
  locale: Locale,
  extra: BreadcrumbCrumb[] = [],
) {
  const home: BreadcrumbCrumb = {
    name: LABELS.home[locale],
    url: `${BASE_URL}${ROUTE_MAP.home[locale]}`,
  };

  const crumbs: BreadcrumbCrumb[] =
    pageId === "home"
      ? [home]
      : [home, { name: LABELS[pageId][locale], url: `${BASE_URL}${ROUTE_MAP[pageId][locale]}` }];

  const all = [...crumbs, ...extra];

  return {
    "@type": "BreadcrumbList",
    "@id": `${all[all.length - 1].url}#breadcrumb`,
    itemListElement: all.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
}
