import OrganicHome from "@/components/organic/OrganicHome";
import { useHead } from "@/hooks/use-head";
import { useI18n } from "@/i18n/context";

const Index = () => {
  const { locale } = useI18n();

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
    canonical: "https://elias-masaje-valencia-web.lovable.app/",
    ogTitle: title,
    ogDescription: desc,
    ogType: "website",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": "https://elias-masaje-valencia-web.lovable.app/#organization",
          name: "Elias Masaje",
          url: "https://elias-masaje-valencia-web.lovable.app",
          telephone: "+34698968007",
          sameAs: ["https://instagram.com/elias_masaje"],
        },
        {
          "@type": "HealthAndBeautyBusiness",
          "@id": "https://elias-masaje-valencia-web.lovable.app/#localbusiness",
          name: "Elias Masaje",
          description: desc,
          url: "https://elias-masaje-valencia-web.lovable.app",
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
            ratingValue: "5.0",
            reviewCount: "66",
          },
          sameAs: ["https://instagram.com/elias_masaje"],
        },
        {
          "@type": "WebSite",
          "@id": "https://elias-masaje-valencia-web.lovable.app/#website",
          url: "https://elias-masaje-valencia-web.lovable.app",
          name: "Elias Masaje",
          publisher: { "@id": "https://elias-masaje-valencia-web.lovable.app/#organization" },
          inLanguage: locale === "es" ? "es-ES" : locale === "ru" ? "ru-RU" : "en-US",
        },
      ],
    },
  });

  return <OrganicHome />;
};

export default Index;
