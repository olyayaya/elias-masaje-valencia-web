import OrganicHome from "@/components/organic/OrganicHome";
import { useHead } from "@/hooks/use-head";
import { useI18n } from "@/i18n/context";
import { useSiteContent } from "@/hooks/use-site-content";
import { BASE_URL, ROUTE_MAP, getAlternates } from "@/config/routes";

const Index = () => {
  const { locale } = useI18n();
  const { content: sc } = useSiteContent();

  const title = locale === "es"
    ? "Elias Masaje — Masaje profesional en Valencia"
    : locale === "ru"
    ? "Elias Masaje — Профессиональный массаж в Валенсии"
    : "Elias Masaje — Professional Massage in Valencia";

  const desc = locale === "es"
    ? "Masaje profesional en el centro de Valencia. Descontracturante, relajante y deportivo. Reserva tu sesión por WhatsApp."
    : locale === "ru"
    ? "Профессиональный массаж в центре Валенсии. Лечебный, расслабляющий и спортивный. Запишитесь через WhatsApp."
    : "Professional massage in central Valencia. Deep tissue, relaxation and sports massage. Book your session via WhatsApp.";

  useHead({
    title,
    description: desc,
    canonical: `${BASE_URL}${ROUTE_MAP.home[locale]}`,
    ogTitle: title,
    ogDescription: desc,
    ogType: "website",
    alternates: getAlternates("home"),
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": `${BASE_URL}/#organization`,
          name: "Elias Masaje",
          url: BASE_URL,
          telephone: "+34698968007",
          sameAs: ["https://instagram.com/elias_masaje"],
        },
        {
          "@type": "HealthAndBeautyBusiness",
          "@id": `${BASE_URL}/#localbusiness`,
          name: "Elias Masaje",
          description: desc,
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
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: sc.google_rating || "5.0",
            reviewCount: sc.google_review_count || "66",
          },
          sameAs: ["https://instagram.com/elias_masaje"],
        },
        {
          "@type": "WebSite",
          "@id": `${BASE_URL}/#website`,
          url: BASE_URL,
          name: "Elias Masaje",
          publisher: { "@id": `${BASE_URL}/#organization` },
          inLanguage: locale === "es" ? "es-ES" : locale === "ru" ? "ru-RU" : "en-US",
        },
      ],
    },
  });

  return <OrganicHome />;
};

export default Index;
