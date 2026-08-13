import { supabase } from "@/integrations/supabase/client";

/**
 * Lightweight analytics helper.
 * 1. Pushes events to GA4 (via gtag) and GTM (via dataLayer).
 * 2. Mirrors conversion events into our own `conversion_events` table so the
 *    dashboard can show attribution counts immediately without GA4 Data API.
 */
type EventParams = Record<string, string | number | boolean | undefined>;

function pushToGa(eventName: string, params: EventParams) {
  try {
    const w = window as unknown as {
      gtag?: (cmd: string, name: string, params?: EventParams) => void;
      dataLayer?: unknown[];
    };
    if (Array.isArray(w.dataLayer)) w.dataLayer.push({ event: eventName, ...params });
    if (typeof w.gtag === "function") w.gtag("event", eventName, params);
  } catch {
    /* analytics must never break the UI */
  }
}

function logToDb(eventName: string, location: string, extra: EventParams) {
  // Skip dashboard / preview noise
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/dashboard")) return;
  // Fire-and-forget — don't block navigation. `.then()` is required: the
  // Supabase query builder is lazy and never runs without it.
  supabase.from("conversion_events").insert([{
    event_name: eventName,
    location,
    metadata: extra as any,
    page_path: typeof window !== "undefined" ? window.location.pathname + window.location.search : "",
    locale: typeof document !== "undefined" ? document.documentElement.lang || "" : "",
  }]).then(({ error }) => { if (error) console.warn("analytics log failed", error.message); });
}

export function trackEvent(eventName: string, params: EventParams = {}) {
  pushToGa(eventName, params);
}

/** Conversion: user clicked a WhatsApp booking CTA. */
export function trackWhatsAppClick(location: string, extra: EventParams = {}) {
  pushToGa("whatsapp_click", { location, method: "WhatsApp", ...extra });
  pushToGa("generate_lead", { location, method: "WhatsApp", ...extra });
  logToDb("whatsapp_click", location, extra);
}

/** Conversion: contact form / contact-page CTA submitted. */
export function trackContactSubmit(location: string, extra: EventParams = {}) {
  pushToGa("contact_submit", { location, ...extra });
  pushToGa("generate_lead", { location, method: "form", ...extra });
  logToDb("contact_submit", location, extra);
}

/** Stable per-visit id (sessionStorage only, no cookies, no cross-site tracking). */
function visitId(): string {
  try {
    const k = "em-visit";
    let v = sessionStorage.getItem(k);
    if (!v) {
      v = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(k, v);
    }
    return v;
  } catch {
    return "";
  }
}

/**
 * Page view: pushed to GA4/GTM and mirrored into `conversion_events` so the
 * dashboard shows real traffic without the GA4 Data API.
 */
export function trackPageView(path: string, title: string, locale: string) {
  pushToGa("page_view", { page_path: path, page_title: title, page_location: window.location.href, language: locale });
  if (window.location.pathname.startsWith("/dashboard")) return;
  const referrer = document.referrer && !document.referrer.includes(window.location.host) ? document.referrer : "";
  supabase.from("conversion_events").insert([{
    event_name: "page_view",
    location: "site",
    page_path: path,
    locale,
    metadata: { title, referrer, visit: visitId() } as any,
  }]).then(({ error }) => { if (error) console.warn("page_view log failed", error.message); });
}
