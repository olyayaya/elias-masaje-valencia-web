CREATE TABLE public.promotions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE NOT NULL,
  badge_text TEXT NOT NULL DEFAULT '',
  badge_text_en TEXT NOT NULL DEFAULT '',
  badge_text_ru TEXT NOT NULL DEFAULT '',
  badge_color TEXT NOT NULL DEFAULT 'amber',
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Promotions are publicly readable" ON public.promotions FOR SELECT TO public USING (true);
CREATE POLICY "Promotions are publicly writable" ON public.promotions FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Promotions are publicly updatable" ON public.promotions FOR UPDATE TO public USING (true);
CREATE POLICY "Promotions are publicly deletable" ON public.promotions FOR DELETE TO public USING (true);