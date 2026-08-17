import OrganicHome from "@/components/organic/OrganicHome";
import { useHead } from "@/hooks/use-head";
import { useI18n } from "@/i18n/context";
import { useSiteContent } from "@/hooks/use-site-content";
import { BASE_URL, ROUTE_MAP, getAlternates } from "@/config/routes";
import { buildBreadcrumbList } from "@/lib/breadcrumbs";
import { buildLocalBusiness, buildOrganization } from "@/lib/local-business";
import { useDbFaqs, resolveField } from "@/hooks/use-db-content";
import { useMemo } from "react";

const Index = () => {
  const { locale, t } = useI18n();
  const { content: sc } = useSiteContent();
  const faqState = useDbFaqs();

  // Mirrors the FAQ list rendered on the homepage. Only emitted once the DB
  // rows have loaded — never from static fallbacks.
  const faqItems = useMemo(
    () =>
      (faqState.data ?? []).map((f) => ({
        question: resolveField(f, "question", locale),
        answer: resolveField(f, "answer", locale),
      })),
    [faqState.data, locale],
  );


  const faqPage = faqItems.length
    ? {
        "@type": "FAQPage",
        "@id": `${BASE_URL}${ROUTE_MAP.home[locale]}#faq`,
        mainEntity: faqItems
          .filter((f) => f.question && f.answer)
          .map((f) => ({
            "@type": "Question",
            name: f.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: f.answer.replace(/<[^>]*>/g, "").trim(),
            },
          })),
      }
    : null;

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
    locale,
    alternates: getAlternates("home"),
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        buildOrganization(locale),
        buildLocalBusiness(locale, { parentOrganization: true }),
        {
          "@type": "WebSite",
          "@id": `${BASE_URL}/#website`,
          url: BASE_URL,
          name: "Elias Masaje",
          publisher: { "@id": `${BASE_URL}/#organization` },
          inLanguage: locale === "es" ? "es-ES" : locale === "ru" ? "ru-RU" : "en-US",
        },
        buildBreadcrumbList("home", locale),
        ...(faqPage && faqPage.mainEntity.length ? [faqPage] : []),
      ],
    },
  });

  return <OrganicHome />;
};

export default Index;
