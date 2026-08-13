import { ExternalLink, Search, MapPin, Star } from "lucide-react";
import DashboardCard from "./DashboardCard";
import StructuredDataPreview from "./StructuredDataPreview";
import SeoTraffic from "./SeoTraffic";
import SeoHealth from "./SeoHealth";
import SearchConsolePanel from "./SearchConsolePanel";
import { useI18n } from "@/i18n/context";
import { useDashboardT } from "@/i18n/dashboard";

const gmaTips = [
  { icon: Star, tip: "Ask happy clients to leave a Google review after their session" },
  { icon: MapPin, tip: "Add your address to every page footer for local relevance" },
  { icon: Search, tip: "Use city + service keywords in H1 tags (e.g., 'Masaje en Valencia')" },
  { icon: ExternalLink, tip: "Get backlinks from local Valencia directories and wellness blogs" },
];

const DashboardSEO = () => {
  const { locale } = useI18n();
  const dt = useDashboardT(locale);

  return (
    <div className="space-y-6">
      {/* Real first-party traffic measured on the live site */}
      <SeoTraffic />

      {/* Live technical SEO checks against the running site + saved settings */}
      <SeoHealth />

      {/* Structured data preview — verifies OfferCatalog matches public site */}
      <StructuredDataPreview />

      {/* Search-query data is Search Console, not GA — flagged honestly rather than faked. */}
      <DashboardCard title="Top Search Queries" description="How people find you on Google">
        <p className="text-xs text-muted-foreground leading-relaxed">{dt.ga4.searchConsoleNote}</p>
      </DashboardCard>

      {/* Google Business Tips */}
      <DashboardCard title="Google Business Optimization Tips">
        <div className="space-y-4">
          {gmaTips.map((t, i) => (
            <div key={i} className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                <t.icon size={14} className="text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{t.tip}</p>
            </div>
          ))}
        </div>
      </DashboardCard>
    </div>
  );
};

export default DashboardSEO;
