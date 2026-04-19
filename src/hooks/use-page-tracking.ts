import { useEffect } from "react";
import { useI18n } from "@/i18n/context";

/**
 * Hook to track page views in Google Analytics 4
 * Automatically sends page_view events with language dimension
 */
export function usePageTracking() {
  const { locale } = useI18n();

  useEffect(() => {
    // Wait for gtag to be available
    if (typeof window.gtag !== "function") return;

    // Get current page path
    const pagePath = window.location.pathname + window.location.search;
    const pageTitle = document.title;

    // Send page_view event with language dimension
    window.gtag("event", "page_view", {
      page_path: pagePath,
      page_title: pageTitle,
      page_location: window.location.href,
      language: locale,
      send_to: "G-FSHT52SP9E",
    });
  }, [locale]);
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
