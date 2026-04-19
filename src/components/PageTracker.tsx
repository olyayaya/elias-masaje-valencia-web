import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useI18n } from "@/i18n/context";

/**
 * Component to track page views in Google Analytics 4
 * Automatically sends page_view events with language dimension on route changes
 */
export function PageTracker() {
  const location = useLocation();
  const { locale } = useI18n();

  useEffect(() => {
    // Wait for gtag to be available
    if (typeof window.gtag !== "function") return;

    // Get current page details
    const pagePath = location.pathname + location.search;
    const pageTitle = document.title;

    // Send page_view event with language dimension
    window.gtag("event", "page_view", {
      page_path: pagePath,
      page_title: pageTitle,
      page_location: window.location.href,
      language: locale,
      send_to: "G-FSHT52SP9E",
    });
  }, [location, locale]);

  return null;
}

// Extend Window interface for gtag
declare global {
  interface Window {
    gtag: (
      command: string,
      targetId: string,
      config?: Record<string, unknown>
    ) => void;
    dataLayer: unknown[];
  }
}
