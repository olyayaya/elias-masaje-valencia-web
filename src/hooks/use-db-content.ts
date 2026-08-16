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
export const resolveField = (record: object, base: string, lang: SiteLang): string => {
  const r = record as Record<string, unknown>;
  if (lang === "es") return (r[base] as string | undefined) ?? "";
  const val = r[langField(base, lang)] as string | undefined;
  return val && val.trim() ? val : ((r[base] as string | undefined) ?? "");
};

/**
 * Explicit async state for every public content read.
 *
 *   loading → the first request hasn't resolved; render skeletons, never
 *             static business facts (see FINDINGS: stale-content flash).
 *   ready   → `data` is authoritative, and may legitimately be an empty array.
 *   error   → the fetch failed; render a neutral localized error + `retry`,
 *             never outdated services / prices / hours.
 */
export type AsyncState<T> =
  | { status: "loading"; data: null; error: null; retry: () => void }
  | { status: "ready"; data: T; error: null; retry: () => void }
  | { status: "error"; data: null; error: Error; retry: () => void };

const toAsyncState = <T,>(
  data: T | undefined,
  isPending: boolean,
  error: Error | null,
  retry: () => void,
): AsyncState<T> => {
  if (error && data === undefined) return { status: "error", data: null, error, retry };
  if (isPending || data === undefined) return { status: "loading", data: null, error: null, retry };
  return { status: "ready", data, error: null, retry };
};

export function useDbServices(): AsyncState<DbService[]> {
  const { data, isPending, error, refetch } = useQuery({
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
  return toAsyncState(data, isPending, error as Error | null, () => void refetch());
}

export function useDbFaqs(): AsyncState<DbFaq[]> {
  const { data, isPending, error, refetch } = useQuery({
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
  return toAsyncState(data, isPending, error as Error | null, () => void refetch());
}

export function useDbTestimonials(): AsyncState<DbTestimonial[]> {
  const { data, isPending, error, refetch } = useQuery({
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
  return toAsyncState(data, isPending, error as Error | null, () => void refetch());
}

export function useDbPromotions(): AsyncState<DbPromotion[]> {
  const { data, isPending, error, refetch } = useQuery({
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
  const filtered = useMemo(() => {
    if (!data) return undefined;
    const now = new Date();
    return data.filter(
      (p) => isBefore(new Date(p.starts_at), now) && isAfter(new Date(p.ends_at), now),
    );
  }, [data]);
  return toAsyncState(filtered, isPending, error as Error | null, () => void refetch());
}

