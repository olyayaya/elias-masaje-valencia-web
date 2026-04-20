import OrganicAbout from "@/components/organic/OrganicAbout";
import { useHead } from "@/hooks/use-head";
import { useI18n } from "@/i18n/context";
import { useSiteContent } from "@/hooks/use-site-content";
import { BASE_URL, ROUTE_MAP, getAlternates } from "@/config/routes";

const SobreMiPage = () => {
  const { locale } = useI18n();
  const { content: sc } = useSiteContent();

  const fallbackTitle = locale === "es"
    ? "Sobre Mí — Elias Masaje Valencia"
    : locale === "ru"
    ? "Обо мне — Elias Masaje Валенсия"
    : "About Me — Elias Masaje Valencia";

  const fallbackDesc = locale === "es"
    ? "Conoce a Elias, masajista profesional en Valencia con experiencia en masaje descontracturante, relajante y deportivo."
    : locale === "ru"
    ? "Познакомьтесь с Элиасом — профессиональным массажистом в Валенсии с опытом в лечебном, расслабляющем и спортивном массаже."
    : "Meet Elias, a professional massage therapist in Valencia specializing in deep tissue, relaxation and sports massage.";

  const title = sc.about_seo_title?.trim() || fallbackTitle;
  const desc = sc.about_seo_description?.trim() || fallbackDesc;

  useHead({
    title,
    description: desc,
    canonical: `${BASE_URL}${ROUTE_MAP.about[locale]}`,
    ogTitle: title,
    ogDescription: desc,
    ogType: "profile",
    alternates: getAlternates("about"),
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Person",
          "@id": `${BASE_URL}/#person`,
          name: "Elias",
          jobTitle: locale === "es" ? "Masajista profesional" : locale === "ru" ? "Профессиональный массажист" : "Professional Massage Therapist",
          description: desc,
          url: `${BASE_URL}${ROUTE_MAP.about[locale]}`,
          worksFor: {
            "@type": "HealthAndBeautyBusiness",
            "@id": `${BASE_URL}/#localbusiness`,
            name: "Elias Masaje",
          },
          workLocation: {
            "@type": "Place",
            address: {
              "@type": "PostalAddress",
              streetAddress: "Calle de la Paz 18",
              addressLocality: "Valencia",
              addressRegion: "Comunidad Valenciana",
              postalCode: "46002",
              addressCountry: "ES",
            },
          },
          knowsAbout: [
            "Deep tissue massage",
            "Relaxation massage",
            "Sports massage",
            "Therapeutic massage",
          ],
          sameAs: ["https://instagram.com/elias_masaje"],
        },
        {
          "@type": "WebPage",
          "@id": `${BASE_URL}${ROUTE_MAP.about[locale]}`,
          name: title,
          description: desc,
          isPartOf: { "@id": `${BASE_URL}/#website` },
          about: { "@id": `${BASE_URL}/#person` },
          inLanguage: locale === "es" ? "es-ES" : locale === "ru" ? "ru-RU" : "en-US",
        },
      ],
    },
  });

  return <OrganicAbout />;
};

export default SobreMiPage;
