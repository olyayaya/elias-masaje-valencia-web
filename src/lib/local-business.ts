import { BASE_URL } from "@/config/routes";
import { Locale } from "@/i18n/types";

/**
 * Shared schema.org LocalBusiness (HealthAndBeautyBusiness) node.
 * Uses a stable @id so every page references the same business entity.
 */
export function buildLocalBusiness(locale: Locale, opts?: { rating?: string; reviewCount?: string }) {
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
    image: `${BASE_URL}/og-image.jpg`,
    logo: `${BASE_URL}/icon-512.png`,
    address: {
      "@type": "PostalAddress",
      streetAddress: "Calle de la Paz 18",
      addressLocality: "Valencia",
      addressRegion: "Comunidad Valenciana",
      postalCode: "46002",
      addressCountry: "ES",
    },
    geo: { "@type": "GeoCoordinates", latitude: 39.4699, longitude: -0.3763 },
    areaServed: { "@type": "City", name: "Valencia" },
    hasMap: "https://maps.google.com/?q=Calle+de+la+Paz+18,+46002+Valencia",
    currenciesAccepted: "EUR",
    paymentAccepted: "Cash, Bizum",
    availableLanguage: ["es", "en", "ru"],
    priceRange: "€€",
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "10:00",
        closes: "20:00",
      },
      { "@type": "OpeningHoursSpecification", dayOfWeek: "Saturday", opens: "10:00", closes: "14:00" },
    ],
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: opts?.rating || "5.0",
      reviewCount: opts?.reviewCount || "66",
    },
    sameAs: ["https://instagram.com/elias_masaje"],
  };
}
