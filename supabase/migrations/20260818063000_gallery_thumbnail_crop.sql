-- Additive, idempotent: non-destructive thumbnail framing for gallery items.
ALTER TABLE public.gallery_items
  ADD COLUMN IF NOT EXISTS thumbnail_x numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS thumbnail_y numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS thumbnail_zoom numeric NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gallery_items_thumbnail_x_range') THEN
    ALTER TABLE public.gallery_items ADD CONSTRAINT gallery_items_thumbnail_x_range CHECK (thumbnail_x >= 0 AND thumbnail_x <= 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gallery_items_thumbnail_y_range') THEN
    ALTER TABLE public.gallery_items ADD CONSTRAINT gallery_items_thumbnail_y_range CHECK (thumbnail_y >= 0 AND thumbnail_y <= 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gallery_items_thumbnail_zoom_range') THEN
    ALTER TABLE public.gallery_items ADD CONSTRAINT gallery_items_thumbnail_zoom_range CHECK (thumbnail_zoom >= 1 AND thumbnail_zoom <= 3);
  END IF;
END $$;
