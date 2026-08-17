import { lazy, Suspense } from "react";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "./i18n/context";
import { ThemeProvider } from "./contexts/ThemeContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Layout from "./components/Layout";
import Index from "./pages/Index";
import ServiciosPage from "./pages/Servicios";
import SobreMiPage from "./pages/SobreMi";
import ContactoPage from "./pages/Contacto";
import PrivacidadPage from "./pages/Privacidad";
import NotFound from "./pages/NotFound";
import ScrollToTop from "./components/ScrollToTop";
import AppErrorBoundary from "./components/AppErrorBoundary";
import CanonicalRedirect from "./components/CanonicalRedirect";
import LocaleSync from "./components/LocaleSync";
import LanguageSuggestionBanner from "./components/LanguageSuggestionBanner";
import ConsentBanner from "./components/ConsentBanner";
import { PageTracker } from "./components/PageTracker";
import { useIntegrationsInjector } from "./hooks/use-integrations-injector";

// Heavy routes are lazy-loaded so their bundles (especially the dashboard's
// TipTap + editor components, and the analytics check page's recharts use)
// don't ship to first-paint of the public site.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const GaleriaPage = lazy(() => import("./pages/Galeria"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPostPage = lazy(() => import("./pages/BlogPost"));
const AnalyticsCheck = lazy(() => import("./pages/AnalyticsCheck"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));
const McpDocs = lazy(() => import("./pages/McpDocs"));

const RouteFallback = () => (
  <div className="flex justify-center items-center min-h-[40vh]">
    <Loader2 className="animate-spin text-muted-foreground" size={20} />
  </div>
);

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
          <CanonicalRedirect />
          <ScrollToTop />
          <LocaleSync />
          <LanguageSuggestionBanner />
          <ConsentBanner />
          <PageTracker />
          <IntegrationsLoader />
          <AppErrorBoundary>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              {/* Spanish (default — no prefix) */}
              <Route element={<Layout />}>
                <Route path="/" element={<Index />} />
                <Route path="/servicios" element={<ServiciosPage />} />
                <Route path="/galeria" element={<GaleriaPage />} />
                <Route path="/sobre-mi" element={<SobreMiPage />} />
                <Route path="/contacto" element={<ContactoPage />} />
                <Route path="/blog" element={<Blog />} />
                <Route path="/blog/:slug" element={<BlogPostPage />} />
                <Route path="/privacidad" element={<PrivacidadPage />} />
              </Route>

              {/* English */}
              <Route element={<Layout />}>
                <Route path="/en" element={<Index />} />
                <Route path="/en/services" element={<ServiciosPage />} />
                <Route path="/en/gallery" element={<GaleriaPage />} />
                <Route path="/en/about" element={<SobreMiPage />} />
                <Route path="/en/contact" element={<ContactoPage />} />
                <Route path="/en/blog" element={<Blog />} />
                <Route path="/en/blog/:slug" element={<BlogPostPage />} />
                <Route path="/en/privacy" element={<PrivacidadPage />} />
              </Route>

              {/* Russian */}
              <Route element={<Layout />}>
                <Route path="/ru" element={<Index />} />
                <Route path="/ru/uslugi" element={<ServiciosPage />} />
                <Route path="/ru/galereya" element={<GaleriaPage />} />
                <Route path="/ru/about" element={<SobreMiPage />} />
                <Route path="/ru/contact" element={<ContactoPage />} />
                <Route path="/ru/blog" element={<Blog />} />
                <Route path="/ru/blog/:slug" element={<BlogPostPage />} />
                <Route path="/ru/privacy" element={<PrivacidadPage />} />
              </Route>

              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analytics-check"
                element={
                  <ProtectedRoute>
                    <AnalyticsCheck />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/mcp-docs"
                element={
                  <ProtectedRoute>
                    <McpDocs />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          </AppErrorBoundary>
        </BrowserRouter>
      </ThemeProvider>
      </I18nProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
