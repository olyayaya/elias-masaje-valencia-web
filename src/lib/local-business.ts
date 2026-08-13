import { BASE_URL } from "@/config/routes";
import { Locale } from "@/i18n/types";
import { INSTAGRAM_URL } from "@/config/contact";

const ADDRESS = {
  "@type": "PostalAddress" as const,
  streetAddress: "Calle de la Paz 18",
  addressLocality: "Valencia",
  addressRegion: "Comunidad Valenciana",
  postalCode: "46002",
  addressCountry: "ES",
};

const GEO = {
  "@type": "GeoCoordinates" as const,
  latitude: 39.4699,
  longitude: -0.3763,
};

const OPENING_HOURS = [
  {
    "@type": "OpeningHoursSpecification" as const,
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    opens: "10:00",
    closes: "20:00",
  },
  {
    "@type": "OpeningHoursSpecification" as const,
    dayOfWeek: "Saturday",
    opens: "10:00",
    closes: "14:00",
  },
];

const SAME_AS = [INSTAGRAM_URL];

/**
 * Shared schema.org Organization node.
 * Rich enough to power the knowledge panel / Organization rich result.
 */
export function buildOrganization(locale: Locale) {
  const description =
    locale === "es"
      ? "Masaje profesional en el centro de Valencia. Descontracturante, relajante y deportivo."
      : locale === "ru"
      ? "Профессиональный массаж в центре Валенсии. Лечебный, расслабляющий и спортивный."
      : "Professional massage in central Valencia. Deep tissue, relaxation and sports massage.";

  return {
    "@type": "Organization",
    "@id": `${BASE_URL}/#organization`,
    name: "Elias Masaje",
    alternateName: "Elias Masaje Valencia",
    description,
    url: BASE_URL,
    logo: `${BASE_URL}/icon-512.png`,
    image: `${BASE_URL}/og-image.jpg`,
    telephone: "+34698968007",
    email: "elias.massagess@gmail.com",
    address: ADDRESS,
    geo: GEO,
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+34698968007",
      contactType: "Booking / Customer Service",
      availableLanguage: ["Spanish", "English", "Russian"],
    },
    sameAs: SAME_AS,
  };
}

/**
 * Shared schema.org LocalBusiness (HealthAndBeautyBusiness) node.
 * Uses a stable @id so every page references the same business entity.
 */
export function buildLocalBusiness(
  locale: Locale,
  opts?: { rating?: string; reviewCount?: string; parentOrganization?: boolean }
) {
  const description =
    locale === "es"
      ? "Masaje profesional en el centro de Valencia. Descontracturante, relajante y deportivo."
      : locale === "ru"
      ? "Профессиональный массаж в центре Валенсии. Лечебный, расслабляющий и спортивный."
      : "Professional massage in central Valencia. Deep tissue, relaxation and sports massage.";

  return {
    "@type": "HealthAndBeautyBusiness",
    "@id": `${BASE_URL}/#localbusiness`,
    name: "Elias Masaje",
    description,
    url: BASE_URL,
    telephone: "+34698968007",
    email: "elias.massagess@gmail.com",
    image: `${BASE_URL}/og-image.jpg`,
    logo: `${BASE_URL}/icon-512.png`,
    address: ADDRESS,
    geo: GEO,
    areaServed: { "@type": "City", name: "Valencia" },
    hasMap: "https://maps.google.com/?q=Calle+de+la+Paz+18,+46002+Valencia",
    currenciesAccepted: "EUR",
    paymentAccepted: "Cash, Bizum",
    availableLanguage: ["es", "en", "ru"],
    priceRange: "€€",
    openingHoursSpecification: OPENING_HOURS,
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+34698968007",
      contactType: "Booking / Customer Service",
      availableLanguage: ["Spanish", "English", "Russian"],
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: opts?.rating || "5.0",
      reviewCount: opts?.reviewCount || "66",
    },
    sameAs: SAME_AS,
    ...(opts?.parentOrganization !== false
      ? { parentOrganization: { "@id": `${BASE_URL}/#organization` } }
      : {}),
  };
}
