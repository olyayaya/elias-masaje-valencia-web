import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, FileText, Search, Image, HelpCircle, MessageSquare, Menu, X, ChevronLeft, History
} from "lucide-react";

import DashboardServices from "@/components/dashboard/DashboardServices";
import DashboardBlog from "@/components/dashboard/DashboardBlog";
import DashboardSEO from "@/components/dashboard/DashboardSEO";
import DashboardMedia from "@/components/dashboard/DashboardMedia";
import DashboardFAQ from "@/components/dashboard/DashboardFAQ";
import DashboardTestimonials from "@/components/dashboard/DashboardTestimonials";

const sections = [
  { id: "services", label: "Services", icon: LayoutDashboard },
  { id: "blog", label: "Blog", icon: FileText },
  { id: "seo", label: "SEO", icon: Search },
  { id: "media", label: "Media", icon: Image },
  { id: "faq", label: "FAQ", icon: HelpCircle },
  { id: "testimonials", label: "Testimonials", icon: MessageSquare },
];

const Dashboard = () => {
  const [active, setActive] = useState("services");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const renderSection = () => {
    switch (active) {
      case "services": return <DashboardServices />;
      case "blog": return <DashboardBlog />;
      case "seo": return <DashboardSEO />;
      case "media": return <DashboardMedia />;
      case "faq": return <DashboardFAQ />;
      case "testimonials": return <DashboardTestimonials />;
      default: return <DashboardServices />;
    }
  };

  return (
    <div className="min-h-screen bg-[#fafaf8] flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-white border-r border-gray-100 flex flex-col transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-gray-900 tracking-tight">Elias Masaje</h1>
            <p className="text-xs text-gray-400 mt-0.5">Site Manager</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {sections.map((s) => {
            const isActive = active === s.id;
            return (
              <button
                key={s.id}
                onClick={() => { setActive(s.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-gray-900 text-white"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                }`}
              >
                <s.icon size={16} />
                {s.label}
              </button>
            );
          })}
        </nav>

        <div className="px-3 pb-4">
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ChevronLeft size={16} />
            Back to site
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-h-screen">
        <header className="sticky top-0 z-30 bg-[#fafaf8]/90 backdrop-blur-sm border-b border-gray-100 px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-500 hover:text-gray-700"
          >
            <Menu size={20} />
          </button>
          <h2 className="text-lg font-semibold text-gray-900 capitalize">{active}</h2>
        </header>

        <div className="p-6 lg:p-8 max-w-5xl">
          {renderSection()}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
