import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isBefore, isAfter } from "date-fns";

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

type SiteLang = "es" | "en" | "ru";

const langField = (base: string, lang: SiteLang): string =>
  lang === "es" ? base : `${base}_${lang}`;

/** Resolve a translated field, falling back to ES (base) */
export const resolveField = (record: Record<string, any>, base: string, lang: SiteLang): string => {
  if (lang === "es") return record[base] ?? "";
  const val = record[langField(base, lang)];
  return val && val.trim() ? val : record[base] ?? "";
};

export function useDbServices() {
  const [services, setServices] = useState<DbService[] | null>(null);

  useEffect(() => {
    supabase
      .from("services")
      .select("*")
      .eq("hidden", false)
      .order("sort_order", { ascending: true })
      .then(({ data }) => { if (data?.length) setServices(data as DbService[]); });
  }, []);

  return services;
}

export function useDbFaqs() {
  const [faqs, setFaqs] = useState<DbFaq[] | null>(null);

  useEffect(() => {
    supabase
      .from("faqs")
      .select("*")
      .order("sort_order", { ascending: true })
      .then(({ data }) => { if (data?.length) setFaqs(data as DbFaq[]); });
  }, []);

  return faqs;
}

export function useDbTestimonials() {
  const [testimonials, setTestimonials] = useState<DbTestimonial[] | null>(null);

  useEffect(() => {
    supabase
      .from("testimonials")
      .select("*")
      .eq("hidden", false)
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (data?.length) setTestimonials(data as DbTestimonial[]); });
  }, []);

  return testimonials;
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

export function useDbPromotions() {
  const [promotions, setPromotions] = useState<DbPromotion[] | null>(null);

  useEffect(() => {
    supabase
      .from("promotions")
      .select("*")
      .eq("active", true)
      .then(({ data }) => {
        if (data) {
          const now = new Date();
          const active = (data as DbPromotion[]).filter(
            (p) => isBefore(new Date(p.starts_at), now) && isAfter(new Date(p.ends_at), now)
          );
          setPromotions(active);
        }
      });
  }, []);

  return promotions;
}
