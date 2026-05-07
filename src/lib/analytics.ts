/**
 * Lightweight GA4 event helper.
 * Pushes to dataLayer (works for both GA4 direct and GTM) and falls back to
 * gtag() when available. Safe no-op if neither is loaded.
 */
type EventParams = Record<string, string | number | boolean | undefined>;

export function trackEvent(eventName: string, params: EventParams = {}) {
  try {
    const w = window as unknown as {
      gtag?: (cmd: string, name: string, params?: EventParams) => void;
      dataLayer?: unknown[];
    };
    // GTM / GA4 dataLayer push (preferred — works with either)
    if (Array.isArray(w.dataLayer)) {
      w.dataLayer.push({ event: eventName, ...params });
    }
    // Direct gtag (when GA4 is loaded without GTM)
    if (typeof w.gtag === "function") {
      w.gtag("event", eventName, params);
    }
  } catch {
    /* analytics must never break the UI */
  }
}

/** Conversion: user clicked a WhatsApp booking CTA. */
export function trackWhatsAppClick(location: string, extra: EventParams = {}) {
  trackEvent("whatsapp_click", {
    location,
    method: "WhatsApp",
    ...extra,
  });
  // Also fire the GA4 standard "generate_lead" event for conversion reports
  trackEvent("generate_lead", {
    location,
    method: "WhatsApp",
    ...extra,
  });
}

/** Conversion: contact form submitted. */
export function trackContactSubmit(location: string, extra: EventParams = {}) {
  trackEvent("contact_submit", { location, ...extra });
  trackEvent("generate_lead", { location, method: "form", ...extra });
}
