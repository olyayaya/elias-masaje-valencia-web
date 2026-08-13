CREATE TABLE public.booking_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  preferred_time TEXT NOT NULL,
  service TEXT NOT NULL,
  duration TEXT,
  price TEXT,
  message TEXT NOT NULL,
  location TEXT,
  page_path TEXT,
  locale TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT INSERT ON public.booking_leads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_leads TO authenticated;
GRANT ALL ON public.booking_leads TO service_role;

ALTER TABLE public.booking_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a booking lead"
  ON public.booking_leads FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(name) BETWEEN 2 AND 60
    AND length(phone) BETWEEN 6 AND 20
    AND length(preferred_time) BETWEEN 3 AND 100
    AND length(service) BETWEEN 1 AND 120
    AND length(message) <= 1000
  );

CREATE POLICY "Admins can view booking leads"
  ON public.booking_leads FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update booking leads"
  ON public.booking_leads FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete booking leads"
  ON public.booking_leads FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_booking_leads_updated_at
  BEFORE UPDATE ON public.booking_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_booking_leads_created_at ON public.booking_leads (created_at DESC);