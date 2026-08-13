import OrganicContact from "@/components/organic/OrganicContact";
import { useHead } from "@/hooks/use-head";
import { useI18n } from "@/i18n/context";
import { BASE_URL, ROUTE_MAP, getAlternates } from "@/config/routes";

const ContactoPage = () => {
  const { locale } = useI18n();

  const title = locale === "es"
    ? "Contacto — Elias Masaje Valencia"
    : locale === "ru"
    ? "Контакты — Elias Masaje Валенсия"
    : "Contact — Elias Masaje Valencia";

  const desc = locale === "es"
    ? "Contacta con Elias Masaje en Valencia. Reserva tu sesión de masaje por WhatsApp o visítanos en el centro de Valencia."
    : locale === "ru"
    ? "Свяжитесь с Elias Masaje в Валенсии. Запишитесь на сеанс массажа через WhatsApp или посетите нас в центре Валенсии."
    : "Contact Elias Masaje in Valencia. Book your massage session via WhatsApp or visit us in central Valencia.";

  useHead({
    title,
    description: desc,
    canonical: `${BASE_URL}${ROUTE_MAP.contact[locale]}`,
    ogTitle: title,
    ogDescription: desc,
    ogType: "website",
    locale,
    alternates: getAlternates("contact"),
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "HealthAndBeautyBusiness",
          "@id": `${BASE_URL}/#localbusiness`,
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
          contactPoint: [
            {
              "@type": "ContactPoint",
              telephone: "+34698968007",
              contactType: "reservations",
              areaServed: "ES",
              availableLanguage: ["Spanish", "English", "Russian"],
            },
            {
              "@type": "ContactPoint",
              url: "https://instagram.com/elias_masaje",
              contactType: "customer service",
            },
          ],
          openingHoursSpecification: [
            { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "10:00", closes: "20:00" },
            { "@type": "OpeningHoursSpecification", dayOfWeek: "Saturday", opens: "10:00", closes: "14:00" },
          ],
          sameAs: ["https://instagram.com/elias_masaje"],
        },
        {
          "@type": "WebPage",
          "@id": `${BASE_URL}${ROUTE_MAP.contact[locale]}`,
          name: title,
          description: desc,
          isPartOf: { "@id": `${BASE_URL}/#website` },
          inLanguage: locale === "es" ? "es-ES" : locale === "ru" ? "ru-RU" : "en-US",
        },
      ],
    },
  });

  return <OrganicContact />;
};

export default ContactoPage;
