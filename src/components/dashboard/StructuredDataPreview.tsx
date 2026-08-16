import { useMemo, useState } from "react";
import { Copy, Check } from "lucide-react";
import DashboardCard from "./DashboardCard";
import LanguageTabs, { Lang } from "./LanguageTabs";
import { useDbServices, resolveField } from "@/hooks/use-db-content";
import { buildLocalBusiness } from "@/lib/local-business";

/**
 * Mirrors the OfferCatalog JSON-LD generated in src/pages/Servicios.tsx so the
 * editor can verify, per locale, that prices, the "from / desde / от" prefix
 * stripping, and hide_* toggles produce the same structured data shipped to
 * Google.
 *
 * IMPORTANT: keep this in sync with Servicios.tsx — both use `resolveField`,
 * `hide_price`, and `hide_price_from`.
 */
const StructuredDataPreview = () => {
  const dbServices = useDbServices().data;
  const [lang, setLang] = useState<Lang>("es");
  const [copied, setCopied] = useState(false);

  const json = useMemo(() => {
    const localBusiness: Record<string, unknown> = {
      "@context": "https://schema.org",
      ...buildLocalBusiness(lang, { parentOrganization: false }),
      hasOfferCatalog: dbServices?.length

        ? {
            "@type": "OfferCatalog",
            name:
              lang === "es"
                ? "Servicios de masaje"
                : lang === "ru"
                ? "Услуги массажа"
                : "Massage Services",
            itemListElement: dbServices.map((s) => {
              const localizedPrice = resolveField(s, "price", lang);
              const offer: any = {
                "@type": "Offer",
                itemOffered: {
                  "@type": "Service",
                  name: resolveField(s, "title", lang),
                  description: resolveField(s, "description", lang),
                  provider: { "@type": "HealthAndBeautyBusiness", name: "Elias Masaje" },
                },
              };
              if (!s.hide_price && localizedPrice) {
                const numeric = localizedPrice.replace(/[^0-9.,]/g, "").replace(",", ".");
                if (numeric) {
                  if (s.hide_price_from) {
                    offer.price = numeric;
                    offer.priceCurrency = "EUR";
                  } else {
                    offer.priceSpecification = {
                      "@type": "PriceSpecification",
                      priceCurrency: "EUR",
                      minPrice: numeric,
                    };
                  }
                }
              }
              return offer;
            }),
          }
        : undefined,
    };
    return JSON.stringify(localBusiness, null, 2);
  }, [dbServices, lang]);

  const copy = async () => {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <DashboardCard
      title="Structured data preview (OfferCatalog)"
      description="Exact JSON-LD shipped to search engines for the selected locale. Verify prices, prefixes, and hidden fields match the public site."
    >
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <LanguageTabs active={lang} onChange={setLang} />
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy JSON"}
        </button>
      </div>
      <pre className="text-[11px] leading-relaxed bg-secondary/60 border border-border rounded-lg p-3 overflow-auto max-h-[480px] font-mono text-foreground">
        {json}
      </pre>
      {!dbServices?.length && (
        <p className="text-xs text-muted-foreground mt-2">No services yet — add services to see the OfferCatalog.</p>
      )}
    </DashboardCard>
  );
};

export default StructuredDataPreview;
