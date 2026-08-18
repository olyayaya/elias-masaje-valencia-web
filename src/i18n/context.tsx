import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { Locale, Translations } from "./types";
import { es } from "./es";
import { en } from "./en";
import { ru } from "./ru";
import { isDashboardPath, loadDashboardLocale } from "@/lib/dashboard-locale";

const translationsMap: Record<Locale, Translations> = { es, en, ru };

function detectInitialLocale(): Locale {
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  // The Dashboard has no locale prefix: use its remembered choice on the very first render
  // so the operator never sees a flash of Spanish after F5.
  if (isDashboardPath(path)) return loadDashboardLocale();
  if (path.startsWith("/en")) return "en";
  if (path.startsWith("/ru")) return "ru";
  return "es";
}

interface I18nContextType {
  locale: Locale;
  t: Translations;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocale] = useState<Locale>(detectInitialLocale);

  // Keep <html lang> in sync on every locale change — including the initial
  // render when someone deep-links to /en or /ru and index.html still says
  // lang="es". Previously the lang attribute only updated after setLocale
  // was called explicitly, which never happened on first paint.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocaleStable = useCallback((l: Locale) => setLocale(l), []);

  return (
    <I18nContext.Provider value={{ locale, t: translationsMap[locale], setLocale: setLocaleStable }}>
      {children}
    </I18nContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
};
