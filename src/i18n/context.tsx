import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Locale, Translations } from "./types";
import { es } from "./es";
import { en } from "./en";
import { ru } from "./ru";

const translationsMap: Record<Locale, Translations> = { es, en, ru };

function detectInitialLocale(): Locale {
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
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
  const [locale, setLocaleState] = useState<Locale>(detectInitialLocale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    document.documentElement.lang = l;
  }, []);

  return (
    <I18nContext.Provider value={{ locale, t: translationsMap[locale], setLocale }}>
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
