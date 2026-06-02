import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n/context";
import { queryKeys } from "@/lib/query-keys";

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
 * Returns a map of content_key → localized value, falling back to ES when
 * the active locale's value is empty. `loaded` is true once the initial
 * fetch has resolved (success or empty); callers can use it to suppress
 * flicker before content arrives.
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
    const key = langKey(locale as Locale);
    for (const r of data) {
      const val = r[key];
      map[r.content_key] = val && val.trim() ? val : r.value_es;
    }
    return map;
  }, [data, locale]);

  return { content, loaded: isFetched };
}
