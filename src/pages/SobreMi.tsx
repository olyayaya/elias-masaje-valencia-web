import OrganicAbout from "@/components/organic/OrganicAbout";
import { useHead } from "@/hooks/use-head";
import { useI18n } from "@/i18n/context";

const SobreMiPage = () => {
  const { locale } = useI18n();

  const title = locale === "es"
    ? "Sobre Mí — Elias Masaje Valencia"
    : locale === "ru"
    ? "Обо мне — Elias Masaje Валенсия"
    : "About Me — Elias Masaje Valencia";

  const desc = locale === "es"
    ? "Conoce a Elias, masajista profesional en Valencia con experiencia en masaje descontracturante, relajante y deportivo."
    : locale === "ru"
    ? "Познакомьтесь с Элиасом — профессиональным массажистом в Валенсии с опытом в лечебном, расслабляющем и спортивном массаже."
    : "Meet Elias, a professional massage therapist in Valencia specializing in deep tissue, relaxation and sports massage.";

  useHead({
    title,
    description: desc,
    canonical: "https://elias-masaje-valencia-web.lovable.app/sobre-mi",
    ogTitle: title,
    ogDescription: desc,
    ogType: "profile",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Person",
          "@id": "https://elias-masaje-valencia-web.lovable.app/#person",
          name: "Elias",
          jobTitle: locale === "es" ? "Masajista profesional" : locale === "ru" ? "Профессиональный массажист" : "Professional Massage Therapist",
          description: desc,
          url: "https://elias-masaje-valencia-web.lovable.app/sobre-mi",
          worksFor: {
            "@type": "HealthAndBeautyBusiness",
            "@id": "https://elias-masaje-valencia-web.lovable.app/#localbusiness",
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
          "@id": "https://elias-masaje-valencia-web.lovable.app/sobre-mi",
          name: title,
          description: desc,
          isPartOf: { "@id": "https://elias-masaje-valencia-web.lovable.app/#website" },
          about: { "@id": "https://elias-masaje-valencia-web.lovable.app/#person" },
          inLanguage: locale === "es" ? "es-ES" : locale === "ru" ? "ru-RU" : "en-US",
        },
      ],
    },
  });

  return <OrganicAbout />;
};

export default SobreMiPage;
