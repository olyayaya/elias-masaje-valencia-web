import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/context";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, FileText, Search, Image, HelpCircle, MessageSquare, PenLine,
  TrendingUp, Eye, Globe, Star, ArrowUpRight, Tag
} from "lucide-react";
import DashboardCard from "./DashboardCard";

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

const DashboardOverview = ({ onNavigate }: { onNavigate: (section: string) => void }) => {
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
      const activePromos = (promos.data || []).filter((p: any) => new Date(p.ends_at) > new Date());
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

      // Count media files
      const { data: mediaFiles } = await supabase.storage.from("media").list();
      if (mediaFiles) setCounts(c => ({ ...c, media: mediaFiles.length }));
    };
    load();
  }, []);

  const quickLinks = [
    {
      id: "services",
      label: "Services",
      icon: LayoutDashboard,
      stat: `${counts.services} active`,
      description: "Manage your massage offerings, prices, and descriptions",
    },
    {
      id: "promotions",
      label: "Promotions",
      icon: Tag,
      stat: `${counts.promotions} active`,
      description: "Add badges like \"Most popular\" or time-limited offers to services",
    },
    {
      id: "content",
      label: "Site Content",
      icon: PenLine,
      stat: `${counts.siteContent} fields`,
      description: "Edit hero text, CTAs, contact info, and section copy",
    },
    {
      id: "blog",
      label: "Blog",
      icon: FileText,
      stat: counts.blogDraft > 0 ? `${counts.blog} posts · ${counts.blogDraft} draft` : `${counts.blog} posts`,
      description: "Write and manage SEO-optimized blog posts with AI",
    },
    {
      id: "faq",
      label: "FAQ",
      icon: HelpCircle,
      stat: `${counts.faqs} questions`,
      description: "Update frequently asked questions shown on the site",
    },
    {
      id: "testimonials",
      label: "Testimonials",
      icon: MessageSquare,
      stat: `${counts.testimonials} reviews`,
      description: "Manage client testimonials and ratings",
    },
    {
      id: "media",
      label: "Media",
      icon: Image,
      stat: `${counts.media} files`,
      description: "Upload and organize images for your site",
    },
    {
      id: "seo",
      label: "SEO",
      icon: Search,
      stat: "Overview",
      description: "Check search performance, keywords, and local SEO tips",
    },
  ];

  const mockStats = [
    { label: "Monthly views", value: "1,240", icon: Eye, trend: "+12%" },
    { label: "Google ranking", value: "Top 5", icon: TrendingUp, trend: "masaje Valencia" },
    { label: "Reviews", value: "66+", icon: Star, trend: "5.0 avg" },
    { label: "Languages", value: "3", icon: Globe, trend: "ES · EN · RU" },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Welcome back</h1>
        <p className="text-sm text-gray-500">Here's an overview of your site. Click any section to manage it.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {mockStats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <s.icon size={14} className="text-gray-400" />
              <span className="text-xs text-gray-500">{s.label}</span>
            </div>
            <p className="text-xl font-semibold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.trend}</p>
          </div>
        ))}
      </div>

      {/* Quick-access grid */}
      <div>
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Manage your site</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {quickLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => onNavigate(link.id)}
              className="group bg-white rounded-xl border border-gray-100 p-5 text-left transition-all hover:border-gray-200 hover:shadow-sm"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center group-hover:bg-gray-100 transition-colors">
                    <link.icon size={16} className="text-gray-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">{link.label}</h3>
                    <p className="text-xs text-gray-400">{link.stat}</p>
                  </div>
                </div>
                <ArrowUpRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors mt-1" />
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{link.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Recent activity hint */}
      <div className="bg-gray-50 rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-medium text-gray-700 mb-1">💡 Tip</h3>
        <p className="text-xs text-gray-500 leading-relaxed">
          Use the <strong>Blog</strong> section to generate SEO-optimized posts with AI — it writes in your brand voice and targets Valencia search terms automatically.
        </p>
      </div>
    </div>
  );
};

export default DashboardOverview;
