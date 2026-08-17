-- ============================================================================
-- PENDING — NOT APPLIED. Reviewed and applied only during the separate rollout.
--
-- Real customer reviews: Google Business Profile and manual entries the owner
-- holds the rights to. TripAdvisor is intentionally NOT a storable source — its
-- Content API terms forbid selective filtering/sorting and commingling licensed
-- reviews with third-party content, so the CHECK constraints below make such a
-- row impossible at the database level.
-- Additive only: nothing existing is dropped or rewritten. The legacy
-- public.testimonials table keeps working until the new section is rolled out.
-- ============================================================================

-- ---------------------------------------------------------------- reviews ---
-- No raw provider payload column exists on purpose: it would be readable by any
-- authenticated user through the table-level SELECT grant, and nothing in the
-- product needs it.
CREATE TABLE IF NOT EXISTS public.reviews (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source            text NOT NULL CHECK (source IN ('google', 'manual')),
  -- Stable id from the source system; for manual imports a deterministic hash.
  external_review_id text NOT NULL CHECK (btrim(external_review_id) <> ''),
  -- Never empty: an incomplete provider record is skipped, never stored with an
  -- invented placeholder author.
  author_name       text NOT NULL CHECK (btrim(author_name) <> '' AND length(author_name) <= 200),
  author_avatar_url text CHECK (author_avatar_url IS NULL OR author_avatar_url ~ '^https://'),
  rating            integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text       text NOT NULL DEFAULT '' CHECK (length(review_text) <= 8000),
  review_language   text CHECK (review_language IS NULL OR length(review_language) <= 12),
  reviewed_at       timestamptz,
  original_url      text CHECK (original_url IS NULL OR original_url ~ '^https://'),
  visible           boolean NOT NULL DEFAULT true,
  pinned            boolean NOT NULL DEFAULT false,
  manual_priority   integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  -- When this row last arrived through a manual CSV/JSON import by an admin.
  imported_at       timestamptz,
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
  allowed_ratings  integer[] NOT NULL DEFAULT '{5}'
                     CHECK (allowed_ratings <@ ARRAY[1,2,3,4,5]),
  allowed_sources  text[] NOT NULL DEFAULT '{google,manual}'
                     CHECK (allowed_sources <@ ARRAY['google','manual']),
  -- Persisted public ordering. Pinned reviews always come first regardless.
  sort_mode        text NOT NULL DEFAULT 'newest'
                     CHECK (sort_mode IN ('newest','oldest','rating_high','rating_low','manual')),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.review_display_settings
  ADD COLUMN IF NOT EXISTS sort_mode text NOT NULL DEFAULT 'newest';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'review_display_settings_sort_mode_check'
  ) THEN
    ALTER TABLE public.review_display_settings
      ADD CONSTRAINT review_display_settings_sort_mode_check
      CHECK (sort_mode IN ('newest','oldest','rating_high','rating_low','manual'));
  END IF;
END $$;

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

-- The function exists only to back an RLS policy; nobody calls it directly.
REVOKE EXECUTE ON FUNCTION public.review_is_public(integer, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_is_public(integer, text, boolean) TO anon, authenticated, service_role;

-- ----------------------------------------------------------------- grants ---
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
-- Anon reads exactly the public card fields (plus the two ordering inputs).
GRANT SELECT (
  id, source, author_name, author_avatar_url, rating, review_text,
  review_language, reviewed_at, original_url, pinned, manual_priority
) ON public.reviews TO anon;

GRANT SELECT, INSERT, UPDATE ON public.review_display_settings TO authenticated;
GRANT ALL ON public.review_display_settings TO service_role;
GRANT SELECT (id, singleton, section_enabled, allowed_ratings, allowed_sources, sort_mode, updated_at)
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
