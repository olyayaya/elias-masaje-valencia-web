-- Lightweight log of conversion events fired client-side (mirrors GA4 events)
CREATE TABLE public.conversion_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  location text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  page_path text NOT NULL DEFAULT '',
  locale text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversion_events_created_at ON public.conversion_events (created_at DESC);
CREATE INDEX idx_conversion_events_event_name ON public.conversion_events (event_name);
CREATE INDEX idx_conversion_events_location ON public.conversion_events (location);

ALTER TABLE public.conversion_events ENABLE ROW LEVEL SECURITY;

-- Match the project's existing public CMS pattern (no auth, dashboard is gated client-side)
CREATE POLICY "Conversion events are publicly readable"
  ON public.conversion_events FOR SELECT USING (true);

CREATE POLICY "Conversion events are publicly writable"
  ON public.conversion_events FOR INSERT WITH CHECK (true);
