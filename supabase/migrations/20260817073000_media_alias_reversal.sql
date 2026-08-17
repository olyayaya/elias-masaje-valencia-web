-- Additive fix: media alias reversal / cycle safety.
-- Previously renaming C back to A could leave both A -> C and C -> A, so a snapshot
-- holding A resolved to the deleted object C. The rewrite routine now repoints chains,
-- drops the alias row for the newly live name, and removes self aliases.

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
  WHERE new_name = _old;

  -- _new is now the name of a LIVE object, so it can never be an alias source.
  -- This is what makes a reversal (A -> B -> C, then C -> A) resolve correctly:
  -- the stale A -> ... row is dropped and B/C both point at A.
  DELETE FROM public.media_aliases WHERE old_name = _new;

  -- Defensive: never keep a self-referencing alias.
  DELETE FROM public.media_aliases WHERE old_name = new_name;

  RETURN total;
END;
$function$;

REVOKE ALL ON FUNCTION public.rewrite_media_references(text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rewrite_media_references(text, text, text, text, uuid) TO service_role;