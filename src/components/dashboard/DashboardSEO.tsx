import { useState } from "react";
import { CheckCircle2, Circle, ExternalLink, Search, MapPin, Star } from "lucide-react";
import DashboardCard from "./DashboardCard";
import StructuredDataPreview from "./StructuredDataPreview";
import Ga4Stats from "./Ga4Stats";
import { useI18n } from "@/i18n/context";
import { useDashboardT } from "@/i18n/dashboard";

const keywordSuggestions = [
  { keyword: "masaje Valencia", volume: "High", difficulty: "Medium" },
  { keyword: "masajista Valencia centro", volume: "Medium", difficulty: "Low" },
  { keyword: "masaje descontracturante Valencia", volume: "Medium", difficulty: "Low" },
  { keyword: "masaje relajante cerca de mí", volume: "High", difficulty: "High" },
  { keyword: "terapia manual Valencia", volume: "Low", difficulty: "Low" },
  { keyword: "dolor de espalda masaje Valencia", volume: "Medium", difficulty: "Medium" },
  { keyword: "masaje deportivo Valencia", volume: "Medium", difficulty: "Low" },
  { keyword: "mejor masajista Valencia", volume: "Medium", difficulty: "Medium" },
];

const localSeoChecklist = [
  { id: "gmb", label: "Google Business Profile claimed and verified", done: true },
  { id: "nap", label: "NAP (Name, Address, Phone) consistent across the web", done: true },
  { id: "reviews", label: "At least 10 Google reviews with responses", done: true },
  { id: "schema", label: "LocalBusiness schema markup on website", done: false },
  { id: "citations", label: "Listed in local directories (Yelp, TripAdvisor, PaginasAmarillas)", done: true },
  { id: "photos", label: "Business photos uploaded to Google Profile", done: false },
  { id: "posts", label: "Regular Google Business posts (weekly)", done: false },
  { id: "categories", label: "Correct categories set (Massage Therapist, Spa)", done: true },
  { id: "hours", label: "Business hours up to date", done: true },
  { id: "desc", label: "Business description optimized with keywords", done: false },
];

const gmaTips = [
  { icon: Star, tip: "Ask happy clients to leave a Google review after their session" },
  { icon: MapPin, tip: "Add your address to every page footer for local relevance" },
  { icon: Search, tip: "Use city + service keywords in H1 tags (e.g., 'Masaje en Valencia')" },
  { icon: ExternalLink, tip: "Get backlinks from local Valencia directories and wellness blogs" },
];

const DashboardSEO = () => {
  const { locale } = useI18n();
  const dt = useDashboardT(locale);
  const [checklist, setChecklist] = useState(localSeoChecklist);

  const toggle = (id: string) => {
    setChecklist(checklist.map((item) =>
      item.id === id ? { ...item, done: !item.done } : item
    ));
  };

  const completedCount = checklist.filter((c) => c.done).length;

  return (
    <div className="space-y-6">
      {/* Structured data preview — verifies OfferCatalog matches public site */}
      <StructuredDataPreview />

      {/* Real Google Analytics traffic */}
      <Ga4Stats days={30} />

      {/* Search-query data is Search Console, not GA — flagged honestly rather than faked. */}
      <DashboardCard title="Top Search Queries" description="How people find you on Google">
        <p className="text-xs text-muted-foreground leading-relaxed">{dt.ga4.searchConsoleNote}</p>
      </DashboardCard>

      {/* Keyword Suggestions */}
      <DashboardCard title="Keyword Suggestions" description="Valencia massage searches to target">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="pb-3 font-medium">Keyword</th>
                <th className="pb-3 font-medium">Volume</th>
                <th className="pb-3 font-medium">Difficulty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {keywordSuggestions.map((kw) => (
                <tr key={kw.keyword}>
                  <td className="py-3 text-foreground">{kw.keyword}</td>
                  <td className="py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      kw.volume === "High" ? "bg-green-500/10 text-green-600" :
                      kw.volume === "Medium" ? "bg-yellow-500/10 text-yellow-600" :
                      "bg-secondary text-muted-foreground"
                    }`}>
                      {kw.volume}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      kw.difficulty === "Low" ? "bg-green-500/10 text-green-600" :
                      kw.difficulty === "Medium" ? "bg-yellow-500/10 text-yellow-600" :
                      "bg-destructive/10 text-destructive"
                    }`}>
                      {kw.difficulty}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardCard>

      {/* Local SEO Checklist */}
      <DashboardCard title="Local SEO Checklist" description={`${completedCount}/${checklist.length} completed`}>
        <div className="space-y-2">
          {checklist.map((item) => (
            <button
              key={item.id}
              onClick={() => toggle(item.id)}
              className="w-full flex items-center gap-3 py-2 px-1 rounded-lg hover:bg-secondary text-left transition-colors"
            >
              {item.done ? (
                <CheckCircle2 size={16} className="text-green-500 shrink-0" />
              ) : (
                <Circle size={16} className="text-muted-foreground/40 shrink-0" />
              )}
              <span className={`text-sm ${item.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
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
