import { useHead } from "@/hooks/use-head";
import { useI18n } from "@/i18n/context";
import { useDbServices, resolveField } from "@/hooks/use-db-content";
import OrganicServices from "@/components/organic/OrganicServices";
import { BASE_URL, ROUTE_MAP, getAlternates } from "@/config/routes";

const ServiciosPage = () => {
  const { locale } = useI18n();
  const dbServices = useDbServices();

  const localBusiness = {
    "@context": "https://schema.org",
    "@type": "HealthAndBeautyBusiness",
    name: "Elias Masaje",
    url: BASE_URL,
    telephone: "+34698968007",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Calle de la Paz 18",
      addressLocality: "Valencia",
      addressRegion: "Comunidad Valenciana",
      postalCode: "46002",
      addressCountry: "ES",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 39.4699,
      longitude: -0.3763,
    },
    priceRange: "€€",
    openingHoursSpecification: [
      { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "10:00", closes: "20:00" },
      { "@type": "OpeningHoursSpecification", dayOfWeek: "Saturday", opens: "10:00", closes: "14:00" },
    ],
    hasOfferCatalog: dbServices?.length ? {
      "@type": "OfferCatalog",
      name: locale === "es" ? "Servicios de masaje" : locale === "ru" ? "Услуги массажа" : "Massage Services",
      itemListElement: dbServices.map((s) => ({
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: resolveField(s, "title", locale),
          description: resolveField(s, "description", locale),
          provider: { "@type": "HealthAndBeautyBusiness", name: "Elias Masaje" },
        },
        price: s.price.replace(/[^0-9.,]/g, ""),
        priceCurrency: "EUR",
      })),
    } : undefined,
  };

  const metaDesc = locale === "es"
    ? "Servicios de masaje terapéutico en Valencia centro: descontracturante, relajante, deportivo y más. Reserva tu sesión en Elias Masaje."
    : locale === "ru"
    ? "Услуги терапевтического массажа в центре Валенсии: лечебный, расслабляющий, спортивный и другие. Запишитесь в Elias Masaje."
    : "Therapeutic massage services in central Valencia: deep tissue, relaxation, sports and more. Book your session at Elias Masaje.";

  const title = locale === "es"
    ? "Servicios de Masaje | Elias Masaje Valencia"
    : locale === "ru"
    ? "Услуги Массажа | Elias Masaje Валенсия"
    : "Massage Services | Elias Masaje Valencia";

  useHead({
    title,
    description: metaDesc,
    canonical: `${BASE_URL}${ROUTE_MAP.services[locale]}`,
    ogTitle: title,
    ogDescription: metaDesc,
    ogType: "website",
    alternates: getAlternates("services"),
    jsonLd: localBusiness,
  });

  return <OrganicServices />;
};

export default ServiciosPage;
