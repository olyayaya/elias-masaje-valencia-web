import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useI18n } from "@/i18n/context";
import { trackPageView } from "@/lib/analytics";

/**
 * Sends a page_view on every route change: to GA4/GTM (when configured) and to
 * our own `conversion_events` table, which powers the dashboard traffic panel.
 */
export function PageTracker() {
  const location = useLocation();
  const { locale } = useI18n();
  const last = useRef<string>("");

  useEffect(() => {
    const path = location.pathname + location.search;
    const key = `${path}|${locale}`;
    if (last.current === key) return; // avoid double-count in StrictMode
    last.current = key;
    // Let the route set its title first. Not cleared on unmount: React StrictMode
    // re-runs effects, and cancelling here would drop every view in dev.
    window.setTimeout(() => trackPageView(path, document.title, locale), 300);
  }, [location, locale]);

  return null;
}

declare global {
  interface Window {
    gtag: (command: string, targetId: string, config?: Record<string, unknown>) => void;
    dataLayer: unknown[];
  }
}
