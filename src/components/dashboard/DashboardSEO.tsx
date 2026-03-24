import { useState } from "react";
import { CheckCircle2, Circle, ExternalLink, Search, MapPin, Star } from "lucide-react";
import DashboardCard from "./DashboardCard";

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
  const [checklist, setChecklist] = useState(localSeoChecklist);

  const toggle = (id: string) => {
    setChecklist(checklist.map((item) =>
      item.id === id ? { ...item, done: !item.done } : item
    ));
  };

  const completedCount = checklist.filter((c) => c.done).length;

  return (
    <div className="space-y-6">
      {/* Keyword Suggestions */}
      <DashboardCard title="Keyword Suggestions" description="Valencia massage searches to target">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                <th className="pb-3 font-medium">Keyword</th>
                <th className="pb-3 font-medium">Volume</th>
                <th className="pb-3 font-medium">Difficulty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {keywordSuggestions.map((kw) => (
                <tr key={kw.keyword}>
                  <td className="py-3 text-gray-700">{kw.keyword}</td>
                  <td className="py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      kw.volume === "High" ? "bg-green-50 text-green-600" :
                      kw.volume === "Medium" ? "bg-yellow-50 text-yellow-600" :
                      "bg-gray-100 text-gray-500"
                    }`}>
                      {kw.volume}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      kw.difficulty === "Low" ? "bg-green-50 text-green-600" :
                      kw.difficulty === "Medium" ? "bg-yellow-50 text-yellow-600" :
                      "bg-red-50 text-red-500"
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
              className="w-full flex items-center gap-3 py-2 px-1 rounded-lg hover:bg-gray-50 text-left transition-colors"
            >
              {item.done ? (
                <CheckCircle2 size={16} className="text-green-500 shrink-0" />
              ) : (
                <Circle size={16} className="text-gray-300 shrink-0" />
              )}
              <span className={`text-sm ${item.done ? "text-gray-400 line-through" : "text-gray-700"}`}>
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
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                <t.icon size={14} className="text-gray-500" />
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{t.tip}</p>
            </div>
          ))}
        </div>
      </DashboardCard>
    </div>
  );
};

export default DashboardSEO;
