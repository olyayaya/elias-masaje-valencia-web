import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useI18n } from "@/i18n/context";
import { getLocaleFromPath } from "@/config/routes";
import { isDashboardPath } from "@/lib/dashboard-locale";

/** Keeps the i18n locale in sync with the current URL path prefix. */
const LocaleSync = () => {
  const { pathname } = useLocation();
  const { locale, setLocale } = useI18n();

  useEffect(() => {
    // The Dashboard is not localized through the URL — never force ES on it.
    if (isDashboardPath(pathname)) return;
    const urlLocale = getLocaleFromPath(pathname);
    if (urlLocale !== locale) setLocale(urlLocale);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
};

export default LocaleSync;
