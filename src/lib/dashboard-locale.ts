import type { Locale } from "@/i18n/types";

/**
 * The Dashboard has no /en or /ru URL prefix, so its language cannot be derived from the
 * path. It is remembered separately here — public pages keep their URL-driven locale.
 */
export const DASHBOARD_LOCALE_KEY = "elias.dashboard.locale";

const VALID: Locale[] = ["es", "en", "ru"];

export const isDashboardPath = (pathname: string): boolean =>
  pathname === "/dashboard" || pathname.startsWith("/dashboard/") || pathname.startsWith("/dashboard?");

/** Corrupted or unknown values fall back to Spanish. */
export function loadDashboardLocale(): Locale {
  try {
    const raw = window.localStorage.getItem(DASHBOARD_LOCALE_KEY);
    if (raw && (VALID as string[]).includes(raw)) return raw as Locale;
  } catch {
    /* private mode / disabled storage */
  }
  return "es";
}

export function saveDashboardLocale(locale: Locale): void {
  if (!(VALID as string[]).includes(locale)) return;
  try {
    window.localStorage.setItem(DASHBOARD_LOCALE_KEY, locale);
  } catch {
    /* ignore */
  }
}
