import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n/context";

interface SiteContentRow {
  content_key: string;
  value_es: string;
  value_en: string;
  value_ru: string;
}

type Locale = "es" | "en" | "ru";

const langKey = (lang: Locale): "value_es" | "value_en" | "value_ru" =>
  lang === "es" ? "value_es" : lang === "en" ? "value_en" : "value_ru";

/** Returns a map of content_key → localized value, falling back to ES */
export function useSiteContent() {
  const { locale } = useI18n();
  const [content, setContent] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase
      .from("site_content")
      .select("content_key, value_es, value_en, value_ru")
      .then(({ data }) => {
        if (data?.length) {
          const map: Record<string, string> = {};
          (data as SiteContentRow[]).forEach((r) => {
            const val = r[langKey(locale as Locale)];
            map[r.content_key] = val?.trim() ? val : r.value_es;
          });
          setContent(map);
        }
        setLoaded(true);
      });
  }, [locale]);

  return { content, loaded };
}
