import OrganicContact from "@/components/organic/OrganicContact";
import { useHead } from "@/hooks/use-head";
import { useI18n } from "@/i18n/context";
import { BASE_URL, ROUTE_MAP, getAlternates } from "@/config/routes";
import { buildBreadcrumbList } from "@/lib/breadcrumbs";

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
        buildLocalBusiness(locale, { parentOrganization: false }),
        {
          "@type": "WebPage",
          "@id": `${BASE_URL}${ROUTE_MAP.contact[locale]}`,
          name: title,
          description: desc,
          isPartOf: { "@id": `${BASE_URL}/#website` },
          inLanguage: locale === "es" ? "es-ES" : locale === "ru" ? "ru-RU" : "en-US",
        },
        buildBreadcrumbList("contact", locale),
      ],
    },

  });

  return <OrganicContact />;
};

export default ContactoPage;
