import { useState } from "react";
import { Link } from "react-router-dom";
import {
  LayoutDashboard, FileText, Search, Image, HelpCircle, MessageSquare, Menu, X, ChevronLeft, History, PenLine, Home, Tag, Globe, ChevronDown, Sun, Moon, Sparkles, Images, Plug, TrendingUp, LogOut, Inbox, GalleryHorizontal,
} from "lucide-react";
import { useI18n } from "@/i18n/context";
import { useHead } from "@/hooks/use-head";
import { Locale } from "@/i18n/types";
import { useDashboardT } from "@/i18n/dashboard";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";

import DashboardOverview from "@/components/dashboard/DashboardOverview";
import DashboardServices from "@/components/dashboard/DashboardServices";
import DashboardBlog from "@/components/dashboard/DashboardBlog";
import DashboardSEO from "@/components/dashboard/DashboardSEO";
import DashboardMedia from "@/components/dashboard/DashboardMedia";
import DashboardFAQ from "@/components/dashboard/DashboardFAQ";
import DashboardReviews from "@/components/dashboard/DashboardReviews";
import DashboardHistory from "@/components/dashboard/DashboardHistory";
import DashboardSiteContent from "@/components/dashboard/DashboardSiteContent";
import DashboardPromotions from "@/components/dashboard/DashboardPromotions";
import DashboardCarousels from "@/components/dashboard/DashboardCarousels";
import DashboardGallery from "@/components/dashboard/DashboardGallery";
import DashboardIntegrations from "@/components/dashboard/DashboardIntegrations";
import DashboardAttribution from "@/components/dashboard/DashboardAttribution";
import DashboardLeads from "@/components/dashboard/DashboardLeads";
import OnboardingDialog from "@/components/dashboard/OnboardingDialog";

// Primary sections — always visible
const primarySections = [
  { id: "overview", icon: Home },
  { id: "services", icon: LayoutDashboard },
  { id: "content", icon: PenLine },
  { id: "carousels", icon: Images },
  { id: "gallery", icon: GalleryHorizontal },
  // Library sits directly after Gallery: the Gallery picker sources its files there.
  { id: "media", icon: Image },
  { id: "faq", icon: HelpCircle },
  { id: "blog", icon: FileText },
  { id: "testimonials", icon: MessageSquare },
] as const;

// Secondary sections — collapsible
const secondarySections = [
  { id: "promotions", icon: Tag },
  { id: "leads", icon: Inbox },
  { id: "attribution", icon: TrendingUp },
  { id: "seo", icon: Search },
  { id: "integrations", icon: Plug },
  { id: "history", icon: History },
] as const;

const allSectionIds = [...primarySections, ...secondarySections].map(s => s.id);

const langLabels: Record<Locale, string> = { es: "ES", en: "EN", ru: "RU" };

const Dashboard = () => {
  // Private admin area: never indexed, never previewed on social.
  useHead({ title: "Panel | Elias Masaje", robots: "noindex, nofollow", noSocial: true });
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
      case "carousels": return <DashboardCarousels />;
      case "gallery": return <DashboardGallery />;
      case "promotions": return <DashboardPromotions />;
      case "blog": return <DashboardBlog />;
      case "seo": return <DashboardSEO />;
      case "integrations": return <DashboardIntegrations />;
      case "leads": return <DashboardLeads />;
      case "attribution": return <DashboardAttribution />;
      case "media": return <DashboardMedia />;
      case "faq": return <DashboardFAQ />;
      case "testimonials": return <DashboardReviews />;
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
      <OnboardingDialog />
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
              aria-label="Cycle theme"
            >
              {mode === "light" ? <Moon size={14} /> : mode === "dark" ? <Sparkles size={14} /> : <Sun size={14} />}
              {mode === "light" ? "Dark" : mode === "dark" ? "Gradient" : "Light"}
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
          <button
            onClick={() => supabase.auth.signOut()}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut size={16} />
            {dt.auth.signOut}
          </button>
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
