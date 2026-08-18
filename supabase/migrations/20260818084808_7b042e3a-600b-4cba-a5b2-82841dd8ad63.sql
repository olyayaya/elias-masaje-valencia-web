DROP POLICY "Services are publicly readable" ON public.services;
CREATE POLICY "Services are publicly readable"
  ON public.services FOR SELECT TO anon, authenticated
  USING (hidden = false);

DROP POLICY "Testimonials are publicly readable" ON public.testimonials;
CREATE POLICY "Testimonials are publicly readable"
  ON public.testimonials FOR SELECT TO anon, authenticated
  USING (hidden = false);

DROP POLICY "Promotions are publicly readable" ON public.promotions;
CREATE POLICY "Promotions are publicly readable"
  ON public.promotions FOR SELECT TO anon, authenticated
  USING (
    active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
  );