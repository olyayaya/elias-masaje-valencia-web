ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS duration_en text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS duration_ru text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS price_en text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS price_ru text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS hide_price boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_duration boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_price_from boolean NOT NULL DEFAULT false;