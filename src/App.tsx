import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
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
import ScrollToTop from "./components/ScrollToTop";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <I18nProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Index />} />
              <Route path="/servicios" element={<ServiciosPage />} />
              <Route path="/sobre-mi" element={<SobreMiPage />} />
              <Route path="/contacto" element={<ContactoPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </I18nProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
