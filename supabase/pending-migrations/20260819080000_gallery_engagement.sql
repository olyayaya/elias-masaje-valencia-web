-- Gallery engagement: view + like counters for public gallery items.
--
-- STATUS: PENDING — this file is NOT applied to production. Apply only after an
-- explicit go-ahead. It is additive and idempotent: existing rows keep their URLs,
-- published flag, sort_order, texts, alt, crop and timestamps; new columns default to 0.

-- 1. Counters on gallery_items -------------------------------------------------
ALTER TABLE public.gallery_items
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gallery_items_view_count_nonneg'
  ) THEN
    ALTER TABLE public.gallery_items
      ADD CONSTRAINT gallery_items_view_count_nonneg CHECK (view_count >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gallery_items_like_count_nonneg'
  ) THEN
    ALTER TABLE public.gallery_items
      ADD CONSTRAINT gallery_items_like_count_nonneg CHECK (like_count >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS gallery_items_view_count_idx
  ON public.gallery_items (view_count DESC, sort_order ASC);
CREATE INDEX IF NOT EXISTS gallery_items_created_at_idx
  ON public.gallery_items (created_at DESC);

-- Public visitors must never UPDATE gallery_items directly; only the RPCs below may
-- touch the counters. (Existing policies already restrict writes to admins.)
REVOKE UPDATE ON public.gallery_items FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.gallery_items FROM anon;

-- 2. Likes ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gallery_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.gallery_items(id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gallery_likes_visitor_len CHECK (char_length(visitor_id) BETWEEN 8 AND 64),
  CONSTRAINT gallery_likes_unique UNIQUE (item_id, visitor_id)
);

CREATE INDEX IF NOT EXISTS gallery_likes_item_idx ON public.gallery_likes (item_id);

-- Data API grants. Reads/writes for visitors happen ONLY through the RPCs, so no
-- direct table privileges are handed to anon/authenticated.
GRANT ALL ON public.gallery_likes TO service_role;
REVOKE ALL ON public.gallery_likes FROM anon, authenticated;

ALTER TABLE public.gallery_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read gallery likes" ON public.gallery_likes;
CREATE POLICY "Admins read gallery likes"
  ON public.gallery_likes
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3. RPC: count one view -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_gallery_view(_item_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_count integer;
BEGIN
  IF _item_id IS NULL THEN
    RAISE EXCEPTION 'invalid gallery item';
  END IF;

  UPDATE public.gallery_items
     SET view_count = view_count + 1
   WHERE id = _item_id
     AND published = true
  RETURNING view_count INTO new_count;

  IF new_count IS NULL THEN
    RAISE EXCEPTION 'gallery item not found or not published';
  END IF;

  RETURN new_count;
END;
$$;

-- 4. RPC: toggle one like ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.toggle_gallery_like(_item_id uuid, _visitor_id text, _liked boolean)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_count integer;
BEGIN
  IF _item_id IS NULL OR _visitor_id IS NULL OR char_length(_visitor_id) NOT BETWEEN 8 AND 64 THEN
    RAISE EXCEPTION 'invalid like arguments';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.gallery_items WHERE id = _item_id AND published = true
  ) THEN
    RAISE EXCEPTION 'gallery item not found or not published';
  END IF;

  IF _liked THEN
    INSERT INTO public.gallery_likes (item_id, visitor_id)
    VALUES (_item_id, _visitor_id)
    ON CONFLICT (item_id, visitor_id) DO NOTHING;
  ELSE
    DELETE FROM public.gallery_likes WHERE item_id = _item_id AND visitor_id = _visitor_id;
  END IF;

  -- Recomputed from the source of truth, so the counter can never drift or go below 0.
  SELECT count(*) INTO new_count FROM public.gallery_likes WHERE item_id = _item_id;

  UPDATE public.gallery_items SET like_count = new_count WHERE id = _item_id;

  RETURN new_count;
END;
$$;

-- 5. Execute grants ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.increment_gallery_view(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.toggle_gallery_like(uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_gallery_view(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.toggle_gallery_like(uuid, text, boolean) TO anon, authenticated, service_role;
