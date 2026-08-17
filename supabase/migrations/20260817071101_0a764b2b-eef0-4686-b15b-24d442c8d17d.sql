-- 1. Additive alias map: old media object name -> current media object name.
CREATE TABLE IF NOT EXISTS public.media_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  old_name text NOT NULL UNIQUE,
  new_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

GRANT SELECT ON public.media_aliases TO authenticated;
GRANT ALL ON public.media_aliases TO service_role;

ALTER TABLE public.media_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read media aliases" ON public.media_aliases;
CREATE POLICY "Admins read media aliases"
ON public.media_aliases
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS media_aliases_new_name_idx ON public.media_aliases (new_name);

-- 2. Actor resolution: auth.uid() when a user calls directly, otherwise the
--    transaction-local actor set by the server-side rewrite routine.
CREATE OR REPLACE FUNCTION public.current_actor()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v text;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RETURN auth.uid();
  END IF;
  v := current_setting('app.actor_id', true);
  IF v IS NULL OR v = '' THEN
    RETURN NULL;
  END IF;
  BEGIN
    RETURN v::uuid;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.current_actor() FROM PUBLIC, anon;

-- 3. History trigger keeps working, now with a non-null author for server-side rewrites.
CREATE OR REPLACE FUNCTION public.log_content_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_key text;
BEGIN
  IF TG_TABLE_NAME = 'site_content' THEN
    v_key := COALESCE(NEW.content_key, OLD.content_key);
    IF v_key ~* '(api_key|secret|token|password|credential)' THEN
      IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
      RETURN NEW;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.content_history (table_name, record_id, snapshot, action, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, to_jsonb(NEW), 'insert', public.current_actor());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.content_history (table_name, record_id, snapshot, action, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, to_jsonb(OLD), 'update', public.current_actor());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.content_history (table_name, record_id, snapshot, action, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, to_jsonb(OLD), 'delete', public.current_actor());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

-- 4. Single-transaction rewrite of every real reference field + alias record.
--    Explicit columns only, no dynamic SQL, service_role only.
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

  -- Alias is written in the SAME transaction as the reference rewrite.
  INSERT INTO public.media_aliases (old_name, new_name, created_by)
  VALUES (_old, _new, _actor)
  ON CONFLICT (old_name) DO UPDATE
    SET new_name = EXCLUDED.new_name,
        created_at = now(),
        created_by = EXCLUDED.created_by;

  -- Collapse any chain that pointed at the old name so lookups stay short.
  UPDATE public.media_aliases SET new_name = _new
  WHERE new_name = _old AND old_name <> _new;

  RETURN total;
END;
$function$;

REVOKE ALL ON FUNCTION public.rewrite_media_references(text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rewrite_media_references(text, text, text, text, uuid) TO service_role;