import { useState } from "react";
import { Link } from "react-router-dom";
import {
  LayoutDashboard, FileText, Search, Image, HelpCircle, MessageSquare, Menu, X, ChevronLeft, History, PenLine, Home, Tag, Globe, ChevronDown, Sun, Moon, Sparkles
} from "lucide-react";
import { useI18n } from "@/i18n/context";
import { Locale } from "@/i18n/types";
import { useDashboardT } from "@/i18n/dashboard";
import { useTheme } from "@/contexts/ThemeContext";

import DashboardOverview from "@/components/dashboard/DashboardOverview";
import DashboardServices from "@/components/dashboard/DashboardServices";
import DashboardBlog from "@/components/dashboard/DashboardBlog";
import DashboardSEO from "@/components/dashboard/DashboardSEO";
import DashboardMedia from "@/components/dashboard/DashboardMedia";
import DashboardFAQ from "@/components/dashboard/DashboardFAQ";
import DashboardTestimonials from "@/components/dashboard/DashboardTestimonials";
import DashboardHistory from "@/components/dashboard/DashboardHistory";
import DashboardSiteContent from "@/components/dashboard/DashboardSiteContent";
import DashboardPromotions from "@/components/dashboard/DashboardPromotions";

// Primary sections — always visible
const primarySections = [
  { id: "overview", icon: Home },
  { id: "services", icon: LayoutDashboard },
  { id: "content", icon: PenLine },
  { id: "faq", icon: HelpCircle },
  { id: "blog", icon: FileText },
  { id: "media", icon: Image },
  { id: "testimonials", icon: MessageSquare },
] as const;

// Secondary sections — collapsible
const secondarySections = [
  { id: "promotions", icon: Tag },
  { id: "seo", icon: Search },
  { id: "history", icon: History },
] as const;

const allSectionIds = [...primarySections, ...secondarySections].map(s => s.id);

const langLabels: Record<Locale, string> = { es: "ES", en: "EN", ru: "RU" };

const Dashboard = () => {
  const [active, setActive] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { locale, setLocale } = useI18n();
  const dt = useDashboardT(locale);
  const { mode, toggleMode } = useTheme();

  const navigateTo = (section: string) => {
    setActive(section);
    setSidebarOpen(false);
  };

  const renderSection = () => {
    switch (active) {
      case "overview": return <DashboardOverview onNavigate={navigateTo} />;
      case "services": return <DashboardServices />;
      case "content": return <DashboardSiteContent />;
      case "promotions": return <DashboardPromotions />;
      case "blog": return <DashboardBlog />;
      case "seo": return <DashboardSEO />;
      case "media": return <DashboardMedia />;
      case "faq": return <DashboardFAQ />;
      case "testimonials": return <DashboardTestimonials />;
      case "history": return <DashboardHistory />;
      default: return <DashboardOverview onNavigate={navigateTo} />;
    }
  };

  const SidebarButton = ({ id, icon: Icon }: { id: string; icon: typeof Home }) => {
    const isActive = active === id;
    const label = dt.sections[id as keyof typeof dt.sections] ?? id;
    return (
      <button
        onClick={() => navigateTo(id)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
          isActive
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        }`}
      >
        <Icon size={16} />
        {label}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-card border-r border-border flex flex-col transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-foreground tracking-tight">Elias Masaje</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{dt.siteManager}</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {primarySections.map((s) => (
            <SidebarButton key={s.id} id={s.id} icon={s.icon} />
          ))}

          {/* Collapsible "More" group */}
          <div className="pt-2">
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider"
            >
              <ChevronDown size={14} className={`transition-transform ${moreOpen ? "rotate-180" : ""}`} />
              More
            </button>
            {moreOpen && (
              <div className="space-y-1 mt-1">
                {secondarySections.map((s) => (
                  <SidebarButton key={s.id} id={s.id} icon={s.icon} />
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="px-3 pb-4 space-y-2">
          <div className="flex items-center gap-2 mx-3">
            <button
              onClick={toggleMode}
              className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label={mode === "light" ? "Switch to dark mode" : "Switch to light mode"}
            >
              {mode === "light" ? <Moon size={14} /> : <Sun size={14} />}
              {mode === "light" ? "Dark" : "Light"}
            </button>
          </div>
          <div className="flex items-center gap-1 bg-secondary rounded-lg p-0.5 mx-3">
            {(Object.keys(langLabels) as Locale[]).map((l) => (
              <button
                key={l}
                onClick={() => setLocale(l)}
                className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  l === locale
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {langLabels[l]}
              </button>
            ))}
          </div>
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={16} />
            {dt.backToSite}
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-h-screen">
        <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
          >
            <Menu size={20} />
          </button>
          <h2 className="text-lg font-semibold text-foreground flex-1">{dt.sections[active as keyof typeof dt.sections] ?? active}</h2>
        </header>

        <div className="p-6 lg:p-8 max-w-5xl">
          {renderSection()}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
