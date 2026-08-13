import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/context";
import { useDashboardT } from "@/i18n/dashboard";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, FileText, Search, Image, HelpCircle, MessageSquare, PenLine,
  ArrowUpRight, Tag
} from "lucide-react";
import DashboardCard from "./DashboardCard";
import TrafficStatCards from "./TrafficStatCards";

interface Counts {
  services: number;
  blog: number;
  blogDraft: number;
  faqs: number;
  testimonials: number;
  media: number;
  siteContent: number;
  promotions: number;
}

const nameByLang: Record<string, string> = { es: "Elias", en: "Elias", ru: "Илья" };

const DashboardOverview = ({ onNavigate }: { onNavigate: (section: string) => void }) => {
  const { locale } = useI18n();
  const dt = useDashboardT(locale);
  const [counts, setCounts] = useState<Counts>({
    services: 0, blog: 0, blogDraft: 0, faqs: 0, testimonials: 0, media: 0, siteContent: 0, promotions: 0,
  });

  useEffect(() => {
    const load = async () => {
      const [services, blog, faqs, testimonials, siteContent, promos] = await Promise.all([
        supabase.from("services").select("id", { count: "exact", head: true }),
        supabase.from("blog_posts").select("id, status"),
        supabase.from("faqs").select("id", { count: "exact", head: true }),
        supabase.from("testimonials").select("id", { count: "exact", head: true }),
        supabase.from("site_content").select("id", { count: "exact", head: true }),
        supabase.from("promotions").select("id, active, ends_at").eq("active", true),
      ]);

      const blogData = blog.data || [];
      const activePromos = (promos.data || []).filter((p: { ends_at: string }) => new Date(p.ends_at) > new Date());
      setCounts({
        services: services.count || 0,
        blog: blogData.length,
        blogDraft: blogData.filter(b => b.status === "draft").length,
        faqs: faqs.count || 0,
        testimonials: testimonials.count || 0,
        media: 0,
        siteContent: siteContent.count || 0,
        promotions: activePromos.length,
      });

      const { data: mediaFiles } = await supabase.storage.from("media").list();
      if (mediaFiles) setCounts(c => ({ ...c, media: mediaFiles.length }));
    };
    load();
  }, []);

  const o = dt.overview;

  const quickLinks = [
    {
      id: "services",
      label: dt.sections.services,
      icon: LayoutDashboard,
      stat: `${counts.services} ${o.servicesActive}`,
      description: o.servicesDesc,
    },
    {
      id: "promotions",
      label: dt.sections.promotions,
      icon: Tag,
      stat: `${counts.promotions} ${o.promotionsActive}`,
      description: o.promotionsDesc,
    },
    {
      id: "content",
      label: dt.sections.content,
      icon: PenLine,
      stat: `${counts.siteContent} ${o.siteContentFields}`,
      description: o.contentDesc,
    },
    {
      id: "blog",
      label: dt.sections.blog,
      icon: FileText,
      stat: counts.blogDraft > 0 ? `${counts.blog} ${o.blogPosts} · ${counts.blogDraft} ${o.blogDraft}` : `${counts.blog} ${o.blogPosts}`,
      description: o.blogDesc,
    },
    {
      id: "faq",
      label: dt.sections.faq,
      icon: HelpCircle,
      stat: `${counts.faqs} ${o.faqQuestions}`,
      description: o.faqDesc,
    },
    {
      id: "testimonials",
      label: dt.sections.testimonials,
      icon: MessageSquare,
      stat: `${counts.testimonials} ${o.testimonialsReviews}`,
      description: o.testimonialsDesc,
    },
    {
      id: "media",
      label: dt.sections.media,
      icon: Image,
      stat: `${counts.media} ${o.mediaFiles}`,
      description: o.mediaDesc,
    },
    {
      id: "seo",
      label: dt.sections.seo,
      icon: Search,
      stat: o.seoOverview,
      description: o.seoDesc,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground mb-1">{dt.welcome}, {nameByLang[locale] ?? "Elias"}</h1>
        <p className="text-sm text-muted-foreground">{dt.siteOverview}</p>
      </div>

      <TrafficStatCards days={30} />

      <div>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">{dt.manageYourSite}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {quickLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => onNavigate(link.id)}
              className="group bg-card rounded-xl border border-border p-5 text-left transition-all hover:border-muted-foreground/30 hover:shadow-sm"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center group-hover:bg-secondary/80 transition-colors">
                    <link.icon size={16} className="text-foreground" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-foreground">{link.label}</h3>
                    <p className="text-xs text-muted-foreground">{link.stat}</p>
                  </div>
                </div>
                <ArrowUpRight size={14} className="text-muted-foreground/50 group-hover:text-muted-foreground transition-colors mt-1" />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{link.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-secondary rounded-xl border border-border p-5">
        <h3 className="text-sm font-medium text-foreground mb-1">{dt.tip}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">{dt.tipText}</p>
      </div>
    </div>
  );
};

export default DashboardOverview;
