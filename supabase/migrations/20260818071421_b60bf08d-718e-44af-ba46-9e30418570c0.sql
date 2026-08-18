-- 1. review_is_public: inline the logic into the RLS policy so anon/authenticated
--    no longer need EXECUTE on a SECURITY DEFINER function.
DROP POLICY IF EXISTS "Public reviews are readable" ON public.reviews;
CREATE POLICY "Public reviews are readable"
ON public.reviews
FOR SELECT
TO anon, authenticated
USING (
  COALESCE(
    (
      SELECT s.section_enabled AND reviews.visible AND reviews.rating = ANY (s.allowed_ratings)
      FROM public.review_display_settings s
      WHERE s.singleton
      LIMIT 1
    ),
    false
  )
);

CREATE OR REPLACE FUNCTION public.review_is_public(_rating integer, _visible boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT COALESCE(
    (
      SELECT s.section_enabled
         AND _visible
         AND _rating = ANY (s.allowed_ratings)
      FROM public.review_display_settings s
      WHERE s.singleton
      LIMIT 1
    ),
    false
  )
$function$;

REVOKE ALL ON FUNCTION public.review_is_public(integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_is_public(integer, boolean) TO service_role;

-- 2. has_role: keep usable from RLS, but a signed-in user may only probe their own uuid.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  jwt_role text := COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::json ->> 'role',
    ''
  );
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;
  -- Trusted contexts: service_role calls and internal/server-side sessions (no JWT).
  -- Untrusted contexts (authenticated): self-check only.
  IF jwt_role NOT IN ('service_role', '') THEN
    IF auth.uid() IS NULL OR _user_id <> auth.uid() THEN
      RETURN false;
    END IF;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 3. count_media_history_refs: fixed empty search_path, service_role only.
CREATE OR REPLACE FUNCTION public.count_media_history_refs(_needle text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT count(*)::int
  FROM public.content_history
  WHERE snapshot::text ILIKE '%' || replace(replace(_needle, '\', '\\'), '%', '\%') || '%'
$function$;

REVOKE ALL ON FUNCTION public.count_media_history_refs(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_media_history_refs(text) TO service_role;

-- 4. current_actor (SECURITY INVOKER helper used by the audit trigger): lock path, drop direct access.
CREATE OR REPLACE FUNCTION public.current_actor()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = ''
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

REVOKE ALL ON FUNCTION public.current_actor() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_actor() TO service_role;

-- 5. Trigger functions: fixed empty search_path + no direct execute for anon/authenticated.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;

CREATE OR REPLACE FUNCTION public.log_content_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

REVOKE ALL ON FUNCTION public.log_content_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_content_change() TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user_bootstrap_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin'::public.app_role) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin'::public.app_role);
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.handle_new_user_bootstrap_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user_bootstrap_admin() TO service_role;

-- 6. swap_gallery_order: keep admin/service_role guard, lock search_path.
CREATE OR REPLACE FUNCTION public.swap_gallery_order(_a uuid, _b uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  order_a integer;
  order_b integer;
  locked_count integer;
  jwt_role text := COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::json ->> 'role',
    ''
  );
BEGIN
  IF NOT (
    jwt_role = 'service_role'
    OR (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'::public.app_role))
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF _a IS NULL OR _b IS NULL OR _a = _b THEN
    RAISE EXCEPTION 'invalid gallery reorder arguments';
  END IF;

  PERFORM id FROM public.gallery_items
   WHERE id IN (_a, _b)
   ORDER BY id
     FOR UPDATE;
  GET DIAGNOSTICS locked_count = ROW_COUNT;

  IF locked_count <> 2 THEN
    RAISE EXCEPTION 'gallery item not found';
  END IF;

  SELECT sort_order INTO order_a FROM public.gallery_items WHERE id = _a;
  SELECT sort_order INTO order_b FROM public.gallery_items WHERE id = _b;

  UPDATE public.gallery_items SET sort_order = order_b WHERE id = _a;
  UPDATE public.gallery_items SET sort_order = order_a WHERE id = _b;

  RETURN 2;
END;
$function$;

REVOKE ALL ON FUNCTION public.swap_gallery_order(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.swap_gallery_order(uuid, uuid) TO authenticated, service_role;

-- 7. rewrite_media_references: defense in depth — trusted caller AND a real admin actor.
CREATE OR REPLACE FUNCTION public.rewrite_media_references(_old text, _new text, _old_enc text, _new_enc text, _actor uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  total int := 0;
  n int;
  o text := _old;
  e text := COALESCE(NULLIF(_old_enc, _old), _old);
  jwt_role text := COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::json ->> 'role',
    ''
  );
BEGIN
  IF jwt_role NOT IN ('service_role', '') THEN
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