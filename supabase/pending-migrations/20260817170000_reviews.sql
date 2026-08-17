-- ============================================================================
-- PENDING — NOT APPLIED. Reviewed and applied only during the separate rollout.
--
-- Real customer reviews (Google Business Profile / TripAdvisor / manual import)
-- Additive only: nothing existing is dropped or rewritten. The legacy
-- public.testimonials table keeps working until the new section is rolled out.
-- ============================================================================

-- ---------------------------------------------------------------- reviews ---
CREATE TABLE IF NOT EXISTS public.reviews (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source            text NOT NULL CHECK (source IN ('google', 'tripadvisor', 'manual')),
  -- Stable id from the source system; for manual imports a deterministic hash.
  external_review_id text NOT NULL,
  author_name       text NOT NULL DEFAULT '',
  author_avatar_url text,
  rating            integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text       text NOT NULL DEFAULT '',
  review_language   text,
  reviewed_at       timestamptz,
  original_url      text,
  visible           boolean NOT NULL DEFAULT true,
  pinned            boolean NOT NULL DEFAULT false,
  manual_priority   integer NOT NULL DEFAULT 0,
  -- Raw provider fields kept only for troubleshooting; never exposed to anon.
  source_payload    jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  last_synced_at    timestamptz,
  CONSTRAINT reviews_source_external_key UNIQUE (source, external_review_id)
);

CREATE INDEX IF NOT EXISTS reviews_visible_rating_idx
  ON public.reviews (visible, rating, reviewed_at DESC);

-- ------------------------------------------------- review_display_settings ---
CREATE TABLE IF NOT EXISTS public.review_display_settings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Singleton guard: exactly one settings row can ever exist.
  singleton        boolean NOT NULL DEFAULT true UNIQUE CHECK (singleton),
  section_enabled  boolean NOT NULL DEFAULT true,
  -- Only 5-star reviews are shown until the owner turns the lower bands on.
  allowed_ratings  integer[] NOT NULL DEFAULT '{5}',
  allowed_sources  text[] NOT NULL DEFAULT '{google,tripadvisor,manual}',
  updated_at       timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.review_display_settings (singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

-- ------------------------------------------------------------- visibility ---
-- Security definer so the anon policy can read the settings row without needing
-- its own recursive policy evaluation.
CREATE OR REPLACE FUNCTION public.review_is_public(_rating integer, _source text, _visible boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT s.section_enabled
         AND _visible
         AND _rating = ANY (s.allowed_ratings)
         AND _source = ANY (s.allowed_sources)
      FROM public.review_display_settings s
      WHERE s.singleton
      LIMIT 1
    ),
    false
  )
$$;

-- ----------------------------------------------------------------- grants ---
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
-- Column-level grant: anon can never read source_payload.
GRANT SELECT (
  id, source, external_review_id, author_name, author_avatar_url, rating,
  review_text, review_language, reviewed_at, original_url, visible, pinned,
  manual_priority, created_at, updated_at
) ON public.reviews TO anon;

GRANT SELECT, INSERT, UPDATE ON public.review_display_settings TO authenticated;
GRANT ALL ON public.review_display_settings TO service_role;
GRANT SELECT (id, singleton, section_enabled, allowed_ratings, allowed_sources, updated_at)
  ON public.review_display_settings TO anon;

-- -------------------------------------------------------------------- RLS ---
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_display_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reviews are readable" ON public.reviews;
CREATE POLICY "Public reviews are readable"
  ON public.reviews FOR SELECT
  TO anon, authenticated
  USING (public.review_is_public(rating, source, visible));

DROP POLICY IF EXISTS "Admins read all reviews" ON public.reviews;
CREATE POLICY "Admins read all reviews"
  ON public.reviews FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage reviews" ON public.reviews;
CREATE POLICY "Admins manage reviews"
  ON public.reviews FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Review display settings are readable" ON public.review_display_settings;
CREATE POLICY "Review display settings are readable"
  ON public.review_display_settings FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage review display settings" ON public.review_display_settings;
CREATE POLICY "Admins manage review display settings"
  ON public.review_display_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- --------------------------------------------------------------- triggers ---
DROP TRIGGER IF EXISTS update_reviews_updated_at ON public.reviews;
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_review_display_settings_updated_at ON public.review_display_settings;
CREATE TRIGGER update_review_display_settings_updated_at
  BEFORE UPDATE ON public.review_display_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Manual moderation (visible / pinned / settings) joins the existing audit trail.
DROP TRIGGER IF EXISTS log_reviews_changes ON public.reviews;
CREATE TRIGGER log_reviews_changes
  BEFORE UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.log_content_change();

DROP TRIGGER IF EXISTS log_review_display_settings_changes ON public.review_display_settings;
CREATE TRIGGER log_review_display_settings_changes
  BEFORE UPDATE ON public.review_display_settings
  FOR EACH ROW EXECUTE FUNCTION public.log_content_change();
