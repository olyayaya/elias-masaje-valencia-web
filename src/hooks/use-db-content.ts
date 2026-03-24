import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DbService {
  id: string;
  title: string;
  duration: string;
  price: string;
  description: string;
  sort_order: number;
}

export interface DbFaq {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
}

export interface DbTestimonial {
  id: string;
  name: string;
  quote: string;
  source: string;
  rating: number;
}

export function useDbServices() {
  const [services, setServices] = useState<DbService[] | null>(null);

  useEffect(() => {
    supabase
      .from("services")
      .select("*")
      .order("sort_order", { ascending: true })
      .then(({ data }) => { if (data?.length) setServices(data); });
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
      .then(({ data }) => { if (data?.length) setFaqs(data); });
  }, []);

  return faqs;
}

export function useDbTestimonials() {
  const [testimonials, setTestimonials] = useState<DbTestimonial[] | null>(null);

  useEffect(() => {
    supabase
      .from("testimonials")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (data?.length) setTestimonials(data); });
  }, []);

  return testimonials;
}
