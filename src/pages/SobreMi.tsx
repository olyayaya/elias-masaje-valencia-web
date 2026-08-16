import OrganicAbout from "@/components/organic/OrganicAbout";
import { useHead } from "@/hooks/use-head";
import { useI18n } from "@/i18n/context";
import { useSiteContent } from "@/hooks/use-site-content";
import { BASE_URL, ROUTE_MAP, getAlternates } from "@/config/routes";
import { buildBreadcrumbList } from "@/lib/breadcrumbs";

const SobreMiPage = () => {
  const { locale } = useI18n();
  const { content: sc } = useSiteContent();

  const fallbackTitle = locale === "es"
    ? "Masajista profesional en Valencia — Sobre mí | Elias Masaje"
    : locale === "ru"
    ? "Профессиональный массажист в Валенсии — Обо мне | Elias Masaje"
    : "Professional massage therapist in Valencia — About me | Elias Masaje";

  const fallbackDesc = locale === "es"
    ? "Descubre a Elias, masajista profesional en Valencia especializado en masaje antiestrés, relajante, tejido profundo, piedras calientes y a 4 manos. Reserva tu cita por WhatsApp en el centro de Valencia."
    : locale === "ru"
    ? "Познакомьтесь с Элиасом — профессиональным массажистом в Валенсии с более чем 8-летним опытом в антистресс, расслабляющем, глубокотканевом, каменном и четырёхручном массаже. Запишитесь через WhatsApp в центре Валенсии."
    : "Meet Elias, a professional massage therapist in Valencia with over 8 years of experience in anti-stress, relaxation, deep tissue, hot stone and four-hand massage. Book your session via WhatsApp in central Valencia.";

  const title = sc.about_seo_title?.trim() || fallbackTitle;
  const desc = sc.about_seo_description?.trim() || fallbackDesc;

  useHead({
    title,
    description: desc,
    canonical: `${BASE_URL}${ROUTE_MAP.about[locale]}`,
    ogTitle: title,
    ogDescription: desc,
    ogType: "profile",
    locale,
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
              streetAddress: "Calle San Vicente Mártir, 24",
              addressLocality: "Valencia",
              addressRegion: "Comunidad Valenciana",
              postalCode: "46002",
              addressCountry: "ES",
            },
          },
          knowsAbout:
            locale === "es"
              ? [
                  "Masajista profesional en Valencia",
                  "Masaje antiestrés",
                  "Masaje relajante",
                  "Masaje de tejido profundo",
                  "Masaje con piedras calientes",
                  "Masaje a 4 manos",
                ]
              : locale === "ru"
              ? [
                  "Профессиональный массажист в Валенсии",
                  "Антистресс массаж",
                  "Расслабляющий массаж",
                  "Глубокотканевый массаж",
                  "Каменный массаж",
                  "Четырёхручный массаж",
                ]
              : [
                  "Professional massage therapist in Valencia",
                  "Anti-stress massage",
                  "Relaxation massage",
                  "Deep tissue massage",
                  "Hot stone massage",
                  "Four-hand massage",
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
        buildBreadcrumbList("about", locale),
      ],
    },
  });

  return <OrganicAbout />;
};

export default SobreMiPage;
