-- ============================================================================
-- PENDING — NOT APPLIED. Reviewed and applied only during the separate rollout.
--
-- Additive follow-up for the already-applied public.reviews table.
--
-- Adds the original language tag and one human-made translation column per site
-- language (ES / EN / RU). The original `review_text` is never touched, never
-- overwritten and never generated: translations live in their own nullable
-- columns and a NULL simply means "show the original".
--
-- There is still no provider API, no OAuth, no key, no scheduled job, no
-- scraping and no runtime machine translation anywhere in this product. The
-- translations are prepared by a human and written by an admin.
--
-- Idempotent: safe to run twice. It adds nothing but columns, constraints and
-- the anon column-level SELECT the new public columns need. No existing row is
-- modified and no table-level write privilege is ever handed back to anon.
-- ============================================================================

-- ---------------------------------------------------------------- columns ---
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS original_language text;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS review_text_es    text;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS review_text_en    text;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS review_text_ru    text;

-- ------------------------------------------------------------ constraints ---
-- Nullable on purpose: an existing row without a translation stays valid.
-- A stored value must be a real text, never an empty placeholder.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.reviews'::regclass AND conname = 'reviews_original_language_check'
  ) THEN
    ALTER TABLE public.reviews
      ADD CONSTRAINT reviews_original_language_check CHECK (
        original_language IS NULL
        OR original_language ~ '^[a-z]{2,3}(-[a-z0-9]{2,8})*$'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.reviews'::regclass AND conname = 'reviews_review_text_es_check'
  ) THEN
    ALTER TABLE public.reviews
      ADD CONSTRAINT reviews_review_text_es_check CHECK (
        review_text_es IS NULL OR (btrim(review_text_es) <> '' AND length(review_text_es) <= 8000)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.reviews'::regclass AND conname = 'reviews_review_text_en_check'
  ) THEN
    ALTER TABLE public.reviews
      ADD CONSTRAINT reviews_review_text_en_check CHECK (
        review_text_en IS NULL OR (btrim(review_text_en) <> '' AND length(review_text_en) <= 8000)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.reviews'::regclass AND conname = 'reviews_review_text_ru_check'
  ) THEN
    ALTER TABLE public.reviews
      ADD CONSTRAINT reviews_review_text_ru_check CHECK (
        review_text_ru IS NULL OR (btrim(review_text_ru) <> '' AND length(review_text_ru) <= 8000)
      );
  END IF;
END
$$;

-- ----------------------------------------------------------------- grants ---
-- Drop every anon privilege first, then hand back exactly one column-level
-- SELECT listing the full public column set. Anon never holds a table-level
-- privilege on public.reviews, so a new column is invisible until it is added
-- to this single list on purpose.
REVOKE ALL PRIVILEGES ON TABLE public.reviews FROM anon;

GRANT SELECT (
  id, author_name, rating, review_text, original_language,
  review_text_es, review_text_en, review_text_ru,
  reviewed_at, original_url, pinned, manual_priority
) ON public.reviews TO anon;

-- authenticated already holds table-level SELECT/INSERT/UPDATE/DELETE, which
-- covers new columns automatically; service_role keeps ALL.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;

