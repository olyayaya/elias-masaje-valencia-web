-- PREPARED, NOT APPLIED.
-- Localized blog slugs (additive, non-destructive).
-- The legacy public.blog_posts.slug column is intentionally left untouched so
-- every existing URL keeps resolving during the staged rollout.

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS slug_es text,
  ADD COLUMN IF NOT EXISTS slug_en text,
  ADD COLUMN IF NOT EXISTS slug_ru text;

-- 1) Backfill every row from the legacy slug so no article loses a URL.
UPDATE public.blog_posts
SET slug_es = COALESCE(NULLIF(slug_es, ''), NULLIF(slug, '')),
    slug_en = COALESCE(NULLIF(slug_en, ''), NULLIF(slug, '')),
    slug_ru = COALESCE(NULLIF(slug_ru, ''), NULLIF(slug, ''));

-- 2) Apply the confirmed mapping for the four published articles.
UPDATE public.blog_posts
SET slug_es = 'beneficios-masaje-deportivo-corredores-valencia',
    slug_en = 'sports-massage-benefits-runners-active-men-valencia',
    slug_ru = 'sportivnyy-massazh-dlya-begunov-valensiya'
WHERE slug = 'sportivnyy-massazh-dlya-begunov-valensiya';

UPDATE public.blog_posts
SET slug_es = 'masaje-antiestres-hombres-valencia',
    slug_en = 'anti-stress-massage-men-valencia',
    slug_ru = 'antistress-massazh-dlya-muzhchin-valensiya'
WHERE slug = 'antistress-massazh-dlya-muzhchin-valensiya';

UPDATE public.blog_posts
SET slug_es = '5-beneficios-masaje-espalda-oficinistas',
    slug_en = '5-benefits-back-massage-office-workers',
    slug_ru = '5-preimushchestv-massazha-spiny-dlya-ofisnykh-rabotnikov'
WHERE slug = '5-beneficios-masaje-espalda-oficinistas';

UPDATE public.blog_posts
SET slug_es = 'beneficios-masaje-regular',
    slug_en = 'benefits-of-regular-massage',
    slug_ru = 'polza-regulyarnogo-massazha'
WHERE slug = 'beneficios-masaje-regular';

-- 3) Partial unique indexes: uniqueness only where a localized slug is set.
CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_slug_es_key
  ON public.blog_posts (slug_es) WHERE slug_es IS NOT NULL AND slug_es <> '';
CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_slug_en_key
  ON public.blog_posts (slug_en) WHERE slug_en IS NOT NULL AND slug_en <> '';
CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_slug_ru_key
  ON public.blog_posts (slug_ru) WHERE slug_ru IS NOT NULL AND slug_ru <> '';

-- 4) Format guard (lowercase ASCII + hyphens), non-destructive: NULL/'' allowed.
ALTER TABLE public.blog_posts
  DROP CONSTRAINT IF EXISTS blog_posts_localized_slug_format;
ALTER TABLE public.blog_posts
  ADD CONSTRAINT blog_posts_localized_slug_format CHECK (
    (slug_es IS NULL OR slug_es = '' OR slug_es ~ '^[a-z0-9]+(-[a-z0-9]+)*$') AND
    (slug_en IS NULL OR slug_en = '' OR slug_en ~ '^[a-z0-9]+(-[a-z0-9]+)*$') AND
    (slug_ru IS NULL OR slug_ru = '' OR slug_ru ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
  );

-- No NOT NULL constraint is added here on purpose: the rollout is staged.
-- Existing GRANTs and RLS policies on public.blog_posts are unchanged.
