CREATE OR REPLACE FUNCTION public.count_media_history_refs(_needle text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT count(*)::int
  FROM public.content_history
  WHERE snapshot::text ILIKE '%' || replace(replace(_needle, '\', '\\'), '%', '\%') || '%'
$$;

REVOKE ALL ON FUNCTION public.count_media_history_refs(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_media_history_refs(text) TO service_role;