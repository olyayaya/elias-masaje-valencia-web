-- Tighten caller-identity guards: only an explicit service_role JWT claim is trusted.
-- Absent / empty / malformed claims no longer grant elevated behaviour.

-- Malformed-safe reader for request.jwt.claims -> role. Returns '' when there is
-- no JWT or the claims payload is not valid JSON.
CREATE OR REPLACE FUNCTION public.jwt_role_claim()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  raw text := NULLIF(current_setting('request.jwt.claims', true), '');
BEGIN
  IF raw IS NULL THEN
    RETURN '';
  END IF;
  BEGIN
    RETURN COALESCE(raw::json ->> 'role', '');
  EXCEPTION WHEN others THEN
    RETURN '';
  END;
END;
$function$;

REVOKE ALL ON FUNCTION public.jwt_role_claim() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.jwt_role_claim() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  jwt_role text := public.jwt_role_claim();
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  IF jwt_role = 'service_role' THEN
    -- Trusted server-side caller: may check any user.
    NULL;
  ELSIF jwt_role = 'authenticated' THEN
    -- Signed-in caller: self-check only.
    IF auth.uid() IS NULL OR _user_id <> auth.uid() THEN
      RETURN false;
    END IF;
  ELSE
    -- Empty, null, malformed, anon or any other claim: no answer at all.
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rewrite_media_references(_old text, _new text, _old_enc text, _new_enc text, _actor uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  total int := 0;
  n int;
  o text := _old;
  e text := COALESCE(NULLIF(_old_enc, _old), _old);
  jwt_role text := public.jwt_role_claim();
BEGIN
  -- Only an explicit service_role claim is trusted. Empty, null, malformed,
  -- anon or authenticated claims are rejected before any DML runs.
  IF jwt_role IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF _actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _actor AND role = 'admin'::public.app_role
  ) THEN
    RAISE EXCEPTION 'actor must be an admin';
  END IF;

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
    alt_text = replace(replace(alt_text, o, _new), e, _new_enc),
    alt_text_en = replace(replace(alt_text_en, o, _new), e, _new_enc),
    alt_text_ru = replace(replace(alt_text_ru, o, _new), e, _new_enc)
  WHERE position(o in image_url) > 0 OR position(e in image_url) > 0
     OR position(o in alt_text) > 0 OR position(e in alt_text) > 0
     OR position(o in COALESCE(alt_text_en, '')) > 0 OR position(e in COALESCE(alt_text_en, '')) > 0
     OR position(o in COALESCE(alt_text_ru, '')) > 0 OR position(e in COALESCE(alt_text_ru, '')) > 0;
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

  UPDATE public.media_aliases SET new_name = _new
  WHERE new_name = _old;

  DELETE FROM public.media_aliases WHERE old_name = _new;

  DELETE FROM public.media_aliases WHERE old_name = new_name;

  RETURN total;
END;
$function$;

REVOKE ALL ON FUNCTION public.rewrite_media_references(text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rewrite_media_references(text, text, text, text, uuid) TO service_role;