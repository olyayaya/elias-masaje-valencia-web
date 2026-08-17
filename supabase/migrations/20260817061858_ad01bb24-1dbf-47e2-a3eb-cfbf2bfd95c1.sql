-- 1. Track who made a change (nullable, additive)
ALTER TABLE public.content_history
  ADD COLUMN IF NOT EXISTS changed_by uuid;

-- 2. Extend the existing history trigger function: also log INSERT, record the actor,
--    and never store secret-like site_content rows.
CREATE OR REPLACE FUNCTION public.log_content_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_key text;
BEGIN
  -- Skip secret-like site_content entries so no credential ever lands in history
  IF TG_TABLE_NAME = 'site_content' THEN
    v_key := COALESCE(NEW.content_key, OLD.content_key);
    IF v_key ~* '(api_key|secret|token|password|credential)' THEN
      IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
      RETURN NEW;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.content_history (table_name, record_id, snapshot, action, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, to_jsonb(NEW), 'insert', auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.content_history (table_name, record_id, snapshot, action, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, to_jsonb(OLD), 'update', auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.content_history (table_name, record_id, snapshot, action, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, to_jsonb(OLD), 'delete', auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

-- 3. Attach history to site_content and promotions (no duplicates)
DROP TRIGGER IF EXISTS log_site_content_changes ON public.site_content;
CREATE TRIGGER log_site_content_changes
BEFORE UPDATE OR DELETE ON public.site_content
FOR EACH ROW EXECUTE FUNCTION public.log_content_change();

DROP TRIGGER IF EXISTS log_site_content_inserts ON public.site_content;
CREATE TRIGGER log_site_content_inserts
AFTER INSERT ON public.site_content
FOR EACH ROW EXECUTE FUNCTION public.log_content_change();

DROP TRIGGER IF EXISTS log_promotions_changes ON public.promotions;
CREATE TRIGGER log_promotions_changes
BEFORE UPDATE OR DELETE ON public.promotions
FOR EACH ROW EXECUTE FUNCTION public.log_content_change();

DROP TRIGGER IF EXISTS log_promotions_inserts ON public.promotions;
CREATE TRIGGER log_promotions_inserts
AFTER INSERT ON public.promotions
FOR EACH ROW EXECUTE FUNCTION public.log_content_change();