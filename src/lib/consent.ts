/**
 * Cookie consent state for GDPR + Spanish cookie-law (LSSI / RGPD).
 *
 * Categories follow the granularity expected by the AEPD: necessary
 * (always on), preferences, analytics, marketing. We mirror the choice
 * into Google Consent Mode v2 so any Google tag respects it.
 */

export interface ConsentCategories {
  /** "Funcional" — always on; can't be disabled. */
  necessary: true;
  preferences: boolean;
  analytics: boolean;
  marketing: boolean;
}

export interface ConsentState {
  categories: ConsentCategories;
  /** ISO timestamp of the decision; used for re-prompt if policy changes. */
  decidedAt: string;
  /** Bump this when the cookie policy materially changes to invalidate stored consent. */
  version: number;
}

export const CONSENT_VERSION = 1;
const STORAGE_KEY = `cookie-consent-v${CONSENT_VERSION}`;
const CONSENT_EVENT = "cookie-consent-changed";

/** Default: everything off except necessary. Used to seed the granular dialog. */
export const DEFAULT_CONSENT: ConsentCategories = {
  necessary: true,
  preferences: false,
  analytics: false,
  marketing: false,
};

export const ALL_GRANTED: ConsentCategories = {
  necessary: true,
  preferences: true,
  analytics: true,
  marketing: true,
};

export function getConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentState;
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setConsent(categories: ConsentCategories): ConsentState {
  const state: ConsentState = {
    categories: { ...categories, necessary: true },
    decidedAt: new Date().toISOString(),
    version: CONSENT_VERSION,
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage may be disabled (private mode); banner will simply re-prompt.
  }
  applyToGoogleConsentMode(state.categories);
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: state }));
  return state;
}

export function clearConsent(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: null }));
}

/** Subscribe to consent changes. Returns an unsubscribe fn. */
export function onConsentChange(cb: (state: ConsentState | null) => void): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<ConsentState | null>).detail;
    cb(detail ?? getConsent());
  };
  window.addEventListener(CONSENT_EVENT, handler);
  return () => window.removeEventListener(CONSENT_EVENT, handler);
}

/**
 * Push our category state into Google Consent Mode v2 via gtag.
 * No-ops if gtag isn't loaded yet — the static head script always sets
 * defaults to denied, so the first update only widens permissions.
 */
export function applyToGoogleConsentMode(c: ConsentCategories): void {
  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtag !== "function") return;
  gtag("consent", "update", {
    ad_storage: c.marketing ? "granted" : "denied",
    ad_user_data: c.marketing ? "granted" : "denied",
    ad_personalization: c.marketing ? "granted" : "denied",
    analytics_storage: c.analytics ? "granted" : "denied",
    functionality_storage: "granted",
    personalization_storage: c.preferences ? "granted" : "denied",
    security_storage: "granted",
  });
}
