-- PENDING (NOT APPLIED): public Gallery section (photos + videos) managed from the Dashboard.
-- Additive only. Apply to production only after explicit confirmation.

CREATE TABLE IF NOT EXISTS public.gallery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_type text NOT NULL DEFAULT 'photo' CHECK (media_type IN ('photo', 'video')),
  media_url text NOT NULL,
  poster_url text NOT NULL DEFAULT '',
  title_es text NOT NULL DEFAULT '',
  title_en text NOT NULL DEFAULT '',
  title_ru text NOT NULL DEFAULT '',
  description_es text NOT NULL DEFAULT '',
  description_en text NOT NULL DEFAULT '',
  description_ru text NOT NULL DEFAULT '',
  alt_es text NOT NULL DEFAULT '',
  alt_en text NOT NULL DEFAULT '',
  alt_ru text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  duration_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Data API access (PostgREST grants nothing on public by default).
GRANT SELECT ON public.gallery_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gallery_items TO authenticated;
GRANT ALL ON public.gallery_items TO service_role;

ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY;

-- Visitors only ever see published items.
DROP POLICY IF EXISTS "Published gallery items are publicly readable" ON public.gallery_items;
CREATE POLICY "Published gallery items are publicly readable"
ON public.gallery_items FOR SELECT
TO anon, authenticated
USING (published = true);

-- Admins (verified through the security-definer role check) manage everything.
DROP POLICY IF EXISTS "Admins read all gallery items" ON public.gallery_items;
CREATE POLICY "Admins read all gallery items"
ON public.gallery_items FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage gallery items" ON public.gallery_items;
CREATE POLICY "Admins manage gallery items"
ON public.gallery_items FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS gallery_items_sort_idx ON public.gallery_items (sort_order, created_at);

DROP TRIGGER IF EXISTS update_gallery_items_updated_at ON public.gallery_items;
CREATE TRIGGER update_gallery_items_updated_at
BEFORE UPDATE ON public.gallery_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS log_gallery_items_changes ON public.gallery_items;
CREATE TRIGGER log_gallery_items_changes
AFTER INSERT OR UPDATE OR DELETE ON public.gallery_items
FOR EACH ROW EXECUTE FUNCTION public.log_content_change();

-- Media renames must follow gallery media + poster references too.
CREATE OR REPLACE FUNCTION public.rewrite_media_references(
  _old text,
  _new text,
  _old_enc text,
  _new_enc text,
  _actor uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total int := 0;
  n int;
  o text := _old;
  e text := COALESCE(NULLIF(_old_enc, _old), _old);
BEGIN
  IF _old IS NULL OR _new IS NULL OR length(_old) = 0 OR length(_new) = 0 OR _old = _new THEN
    RAISE EXCEPTION 'invalid media rename arguments';
  END IF;
  IF _old LIKE '%/%' OR _new LIKE '%/%' OR _old LIKE '%..%' OR _new LIKE '%..%' THEN
    RAISE EXCEPTION 'invalid media object name';
  END IF;

  PERFORM set_config('app.actor_id', COALESCE(_actor::text, ''), true);

  UPDATE public.blog_posts SET
    content = replace(replace(content, o, _new), e, _new_enc),
    content_en = replace(replace(content_en, o, _new), e, _new_enc),
    content_ru = replace(replace(content_ru, o, _new), e, _new_enc),
    meta_description = replace(replace(meta_description, o, _new), e, _new_enc),
    meta_description_en = replace(replace(meta_description_en, o, _new), e, _new_enc),
    meta_description_ru = replace(replace(meta_description_ru, o, _new), e, _new_enc)
  WHERE position(o in content) > 0 OR position(e in content) > 0
     OR position(o in content_en) > 0 OR position(e in content_en) > 0
     OR position(o in content_ru) > 0 OR position(e in content_ru) > 0
     OR position(o in meta_description) > 0 OR position(e in meta_description) > 0
     OR position(o in meta_description_en) > 0 OR position(e in meta_description_en) > 0
     OR position(o in meta_description_ru) > 0 OR position(e in meta_description_ru) > 0;
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  UPDATE public.site_content SET
    value_es = replace(replace(value_es, o, _new), e, _new_enc),
    value_en = replace(replace(value_en, o, _new), e, _new_enc),
    value_ru = replace(replace(value_ru, o, _new), e, _new_enc)
  WHERE position(o in value_es) > 0 OR position(e in value_es) > 0
     OR position(o in value_en) > 0 OR position(e in value_en) > 0
     OR position(o in value_ru) > 0 OR position(e in value_ru) > 0;
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  UPDATE public.page_images SET
    image_url = replace(replace(image_url, o, _new), e, _new_enc),
    alt_text = replace(replace(alt_text, o, _new), e, _new_enc)
  WHERE position(o in image_url) > 0 OR position(e in image_url) > 0
     OR position(o in alt_text) > 0 OR position(e in alt_text) > 0;
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  UPDATE public.gallery_items SET
    media_url = replace(replace(media_url, o, _new), e, _new_enc),
    poster_url = replace(replace(poster_url, o, _new), e, _new_enc)
  WHERE position(o in media_url) > 0 OR position(e in media_url) > 0
     OR position(o in poster_url) > 0 OR position(e in poster_url) > 0;
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  UPDATE public.services SET
    description = replace(replace(description, o, _new), e, _new_enc),
    description_en = replace(replace(description_en, o, _new), e, _new_enc),
    description_ru = replace(replace(description_ru, o, _new), e, _new_enc)
  WHERE position(o in description) > 0 OR position(e in description) > 0
     OR position(o in description_en) > 0 OR position(e in description_en) > 0
     OR position(o in description_ru) > 0 OR position(e in description_ru) > 0;
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  UPDATE public.faqs SET
    question = replace(replace(question, o, _new), e, _new_enc),
    question_en = replace(replace(question_en, o, _new), e, _new_enc),
    question_ru = replace(replace(question_ru, o, _new), e, _new_enc),
    answer = replace(replace(answer, o, _new), e, _new_enc),
    answer_en = replace(replace(answer_en, o, _new), e, _new_enc),
    answer_ru = replace(replace(answer_ru, o, _new), e, _new_enc)
  WHERE position(o in question) > 0 OR position(e in question) > 0
     OR position(o in question_en) > 0 OR position(e in question_en) > 0
     OR position(o in question_ru) > 0 OR position(e in question_ru) > 0
     OR position(o in answer) > 0 OR position(e in answer) > 0
     OR position(o in answer_en) > 0 OR position(e in answer_en) > 0
     OR position(o in answer_ru) > 0 OR position(e in answer_ru) > 0;
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  UPDATE public.promotions SET
    badge_text = replace(replace(badge_text, o, _new), e, _new_enc),
    badge_text_en = replace(replace(badge_text_en, o, _new), e, _new_enc),
    badge_text_ru = replace(replace(badge_text_ru, o, _new), e, _new_enc)
  WHERE position(o in badge_text) > 0 OR position(e in badge_text) > 0
     OR position(o in badge_text_en) > 0 OR position(e in badge_text_en) > 0
     OR position(o in badge_text_ru) > 0 OR position(e in badge_text_ru) > 0;
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  UPDATE public.testimonials SET
    quote = replace(replace(quote, o, _new), e, _new_enc),
    quote_en = replace(replace(quote_en, o, _new), e, _new_enc),
    quote_ru = replace(replace(quote_ru, o, _new), e, _new_enc)
  WHERE position(o in quote) > 0 OR position(e in quote) > 0
     OR position(o in quote_en) > 0 OR position(e in quote_en) > 0
     OR position(o in quote_ru) > 0 OR position(e in quote_ru) > 0;
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

  INSERT INTO public.media_aliases (old_name, new_name, created_by)
  VALUES (_old, _new, _actor)
  ON CONFLICT (old_name) DO UPDATE
    SET new_name = EXCLUDED.new_name,
        created_at = now(),
        created_by = EXCLUDED.created_by;

  UPDATE public.media_aliases SET new_name = _new WHERE new_name = _old;
  DELETE FROM public.media_aliases WHERE old_name = _new;
  DELETE FROM public.media_aliases WHERE old_name = new_name;

  RETURN total;
END;
$function$;

REVOKE ALL ON FUNCTION public.rewrite_media_references(text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rewrite_media_references(text, text, text, text, uuid) TO service_role;
