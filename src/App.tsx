import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { toast } from "sonner";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "./i18n/context";
import { ThemeProvider } from "./contexts/ThemeContext";
import Layout from "./components/Layout";
import Index from "./pages/Index";
import ServiciosPage from "./pages/Servicios";
import SobreMiPage from "./pages/SobreMi";
import ContactoPage from "./pages/Contacto";
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/Dashboard";
import Blog from "./pages/Blog";
import BlogPostPage from "./pages/BlogPost";
import AnalyticsCheck from "./pages/AnalyticsCheck";
import ScrollToTop from "./components/ScrollToTop";
import LocaleSync from "./components/LocaleSync";
import LanguageSuggestionBanner from "./components/LanguageSuggestionBanner";
import { PageTracker } from "./components/PageTracker";
import { useIntegrationsInjector } from "./hooks/use-integrations-injector";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 30s freshness window — edits in the dashboard propagate on next
      // window-focus or after this elapses without re-fetching on every render.
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
  // Surface query errors so a failed fetch is visible instead of silently
  // rendering an empty UI. Mutation errors are toasted at the call site.
  queryCache: new QueryCache({
    onError: (error) => {
      if (import.meta.env.DEV) console.error("[query]", error);
      toast.error(error instanceof Error ? error.message : "Failed to load content");
    },
  }),
});

const IntegrationsLoader = () => {
  useIntegrationsInjector();
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <I18nProvider>
      <ThemeProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <LocaleSync />
          <LanguageSuggestionBanner />
          <PageTracker />
          <IntegrationsLoader />
          <Routes>
            {/* Spanish (default — no prefix) */}
            <Route element={<Layout />}>
              <Route path="/" element={<Index />} />
              <Route path="/servicios" element={<ServiciosPage />} />
              <Route path="/sobre-mi" element={<SobreMiPage />} />
              <Route path="/contacto" element={<ContactoPage />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPostPage />} />
            </Route>

            {/* English */}
            <Route element={<Layout />}>
              <Route path="/en" element={<Index />} />
              <Route path="/en/services" element={<ServiciosPage />} />
              <Route path="/en/about" element={<SobreMiPage />} />
              <Route path="/en/contact" element={<ContactoPage />} />
              <Route path="/en/blog" element={<Blog />} />
              <Route path="/en/blog/:slug" element={<BlogPostPage />} />
            </Route>

            {/* Russian */}
            <Route element={<Layout />}>
              <Route path="/ru" element={<Index />} />
              <Route path="/ru/uslugi" element={<ServiciosPage />} />
              <Route path="/ru/about" element={<SobreMiPage />} />
              <Route path="/ru/contact" element={<ContactoPage />} />
              <Route path="/ru/blog" element={<Blog />} />
              <Route path="/ru/blog/:slug" element={<BlogPostPage />} />
            </Route>

            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/analytics-check" element={<AnalyticsCheck />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
      </I18nProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
