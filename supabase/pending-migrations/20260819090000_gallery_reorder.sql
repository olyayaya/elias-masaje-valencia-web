-- Atomic manual reordering for Dashboard → Gallery.
--
-- STATUS: PENDING — this file is NOT applied to production. Apply only after an
-- explicit go-ahead. It adds a function only; no table, column or row is changed.
--
-- Without it the client falls back to per-row UPDATEs (already allowed for admins by
-- the existing "Admins manage gallery items" policy), so the app works either way.
-- The RPC simply makes the whole 1..N renumbering one statement.

CREATE OR REPLACE FUNCTION public.reorder_gallery_items(_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  touched integer;
BEGIN
  -- Admins only: SECURITY DEFINER must re-check what RLS would have checked.
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  IF _ids IS NULL OR array_length(_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'no gallery items given';
  END IF;

  -- Reject duplicates and unknown ids so a partial write can never scramble the order.
  IF (SELECT count(DISTINCT x) FROM unnest(_ids) AS x) <> array_length(_ids, 1) THEN
    RAISE EXCEPTION 'duplicate gallery item id';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(_ids) AS x
    WHERE NOT EXISTS (SELECT 1 FROM public.gallery_items g WHERE g.id = x)
  ) THEN
    RAISE EXCEPTION 'unknown gallery item id';
  END IF;

  WITH desired AS (
    SELECT id, ord::integer AS position
      FROM unnest(_ids) WITH ORDINALITY AS t(id, ord)
  )
  UPDATE public.gallery_items g
     SET sort_order = d.position,
         updated_at = now()
    FROM desired d
   WHERE g.id = d.id
     AND g.sort_order IS DISTINCT FROM d.position;

  GET DIAGNOSTICS touched = ROW_COUNT;
  RETURN touched;
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_gallery_items(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reorder_gallery_items(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.reorder_gallery_items(uuid[]) TO authenticated, service_role;
