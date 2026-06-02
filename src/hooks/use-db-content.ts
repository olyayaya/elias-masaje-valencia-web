import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isBefore, isAfter } from "date-fns";
import { queryKeys } from "@/lib/query-keys";

export interface DbService {
  id: string;
  title: string;
  duration: string;
  price: string;
  description: string;
  sort_order: number;
  title_en: string;
  title_ru: string;
  description_en: string;
  description_ru: string;
  duration_en: string;
  duration_ru: string;
  price_en: string;
  price_ru: string;
  hide_price: boolean;
  hide_duration: boolean;
  hide_price_from: boolean;
}

export interface DbFaq {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
  question_en: string;
  question_ru: string;
  answer_en: string;
  answer_ru: string;
}

export interface DbTestimonial {
  id: string;
  name: string;
  quote: string;
  source: string;
  rating: number;
  quote_en: string;
  quote_ru: string;
}

export interface DbPromotion {
  id: string;
  service_id: string;
  badge_text: string;
  badge_text_en: string;
  badge_text_ru: string;
  badge_color: string;
  starts_at: string;
  ends_at: string;
  active: boolean;
}

type SiteLang = "es" | "en" | "ru";

const langField = (base: string, lang: SiteLang): string =>
  lang === "es" ? base : `${base}_${lang}`;

/** Resolve a translated field, falling back to ES (base) when the locale value is empty. */
export const resolveField = (record: Record<string, unknown>, base: string, lang: SiteLang): string => {
  if (lang === "es") return (record[base] as string | undefined) ?? "";
  const val = record[langField(base, lang)] as string | undefined;
  return val && val.trim() ? val : ((record[base] as string | undefined) ?? "");
};

/**
 * Public hook return type for the content fetchers.
 *
 *   null  → query is still loading (initial fetch hasn't resolved).
 *   []    → loaded; the table genuinely has no rows.
 *   [...] → loaded with data.
 *
 * Callers that want "fall back to static defaults when empty" must check
 * `data && data.length > 0`, *not* `data?.map(...) ?? defaults` — the latter
 * only triggers the fallback while loading, never for a real empty result.
 */
type Loaded<T> = T[] | null;

export function useDbServices(): Loaded<DbService> {
  const { data } = useQuery({
    queryKey: queryKeys.services,
    queryFn: async (): Promise<DbService[]> => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("hidden", false)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DbService[];
    },
  });
  return data ?? null;
}

export function useDbFaqs(): Loaded<DbFaq> {
  const { data } = useQuery({
    queryKey: queryKeys.faqs,
    queryFn: async (): Promise<DbFaq[]> => {
      const { data, error } = await supabase
        .from("faqs")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DbFaq[];
    },
  });
  return data ?? null;
}

export function useDbTestimonials(): Loaded<DbTestimonial> {
  const { data } = useQuery({
    queryKey: queryKeys.testimonials,
    queryFn: async (): Promise<DbTestimonial[]> => {
      const { data, error } = await supabase
        .from("testimonials")
        .select("*")
        .eq("hidden", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DbTestimonial[];
    },
  });
  return data ?? null;
}

export function useDbPromotions(): Loaded<DbPromotion> {
  const { data } = useQuery({
    queryKey: queryKeys.promotions,
    queryFn: async (): Promise<DbPromotion[]> => {
      const { data, error } = await supabase
        .from("promotions")
        .select("*")
        .eq("active", true);
      if (error) throw error;
      return (data ?? []) as DbPromotion[];
    },
  });
  // Date filter is applied at render time so promotions auto-expire mid-session
  // without needing a re-fetch.
  return useMemo(() => {
    if (!data) return null;
    const now = new Date();
    return data.filter(
      (p) => isBefore(new Date(p.starts_at), now) && isAfter(new Date(p.ends_at), now),
    );
  }, [data]);
}
