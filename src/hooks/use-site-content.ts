import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n/context";
import { queryKeys } from "@/lib/query-keys";
import { isLocaleIndependentKey } from "@/lib/site-content-meta";

interface SiteContentRow {
  content_key: string;
  value_es: string;
  value_en: string;
  value_ru: string;
}

type Locale = "es" | "en" | "ru";

const langKey = (lang: Locale): "value_es" | "value_en" | "value_ru" =>
  lang === "es" ? "value_es" : lang === "en" ? "value_en" : "value_ru";

/**
 * Returns a map of content_key → localized value.
 *
 * Resolution rules:
 *  - Locale-independent keys (see site-content-meta) → always `value_es`.
 *  - Locale-dependent keys → `value_<locale>` if non-empty, otherwise `""`.
 *
 * The empty-string fallback (rather than auto-fallback to `value_es`) lets
 * consumers cleanly fall back to the static i18n translation via the
 * `sc.foo || t.bar.foo` idiom. Previously the hook served `value_es` for any
 * missing translation, which leaked Spanish into EN/RU pages whenever the
 * dashboard admin hadn't translated a row yet.
 *
 * `loaded` is true once the initial fetch resolves (success or empty);
 * callers can use it to suppress flicker before content arrives.
 */
export function useSiteContent() {
  const { locale } = useI18n();
  const { data, isFetched } = useQuery({
    queryKey: queryKeys.siteContent,
    queryFn: async (): Promise<SiteContentRow[]> => {
      const { data, error } = await supabase
        .from("site_content")
        .select("content_key, value_es, value_en, value_ru");
      if (error) throw error;
      return (data ?? []) as SiteContentRow[];
    },
  });

  const content = useMemo(() => {
    const map: Record<string, string> = {};
    if (!data) return map;
    const activeKey = langKey(locale as Locale);
    for (const r of data) {
      if (isLocaleIndependentKey(r.content_key)) {
        map[r.content_key] = r.value_es;
      } else {
        const val = r[activeKey];
        map[r.content_key] = val && val.trim() ? val : "";
      }
    }
    return map;
  }, [data, locale]);

  return { content, loaded: isFetched };
}
