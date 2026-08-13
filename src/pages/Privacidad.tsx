import { useI18n } from "@/i18n/context";
import { useHead } from "@/hooks/use-head";
import { BASE_URL, ROUTE_MAP, getAlternates } from "@/config/routes";

const PrivacidadPage = () => {
  const { locale, t } = useI18n();
  const c = t.cookies.privacy;

  useHead({
    title: c.pageTitle,
    description: c.placeholder,
    canonical: `${BASE_URL}${ROUTE_MAP.privacy[locale]}`,
    ogTitle: c.pageTitle,
    ogDescription: c.placeholder,
    ogType: "article",
    locale,
    alternates: getAlternates("privacy"),
  });

  return (
    <div className="section-padding pt-32 md:pt-36">
      <div className="container-narrow max-w-2xl">
        <h1 className="text-3xl md:text-4xl font-display text-foreground mb-6">
          {c.heading}
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          {c.placeholder}
        </p>
      </div>
    </div>
  );
};

export default PrivacidadPage;
