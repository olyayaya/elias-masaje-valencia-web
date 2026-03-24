-- Content history table to store every edit
CREATE TABLE public.content_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  snapshot jsonb NOT NULL,
  action text NOT NULL DEFAULT 'update',
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_history_lookup ON public.content_history (table_name, record_id, changed_at DESC);

ALTER TABLE public.content_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Content history is publicly readable"
  ON public.content_history FOR SELECT
  USING (true);

CREATE POLICY "Content history is publicly writable"
  ON public.content_history FOR INSERT
  WITH CHECK (true);

-- Function to log changes
CREATE OR REPLACE FUNCTION public.log_content_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.content_history (table_name, record_id, snapshot, action)
    VALUES (TG_TABLE_NAME, OLD.id, to_jsonb(OLD), 'update');
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.content_history (table_name, record_id, snapshot, action)
    VALUES (TG_TABLE_NAME, OLD.id, to_jsonb(OLD), 'delete');
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Attach triggers to all editable tables
CREATE TRIGGER log_services_changes
  BEFORE UPDATE OR DELETE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.log_content_change();

CREATE TRIGGER log_faqs_changes
  BEFORE UPDATE OR DELETE ON public.faqs
  FOR EACH ROW EXECUTE FUNCTION public.log_content_change();

CREATE TRIGGER log_testimonials_changes
  BEFORE UPDATE OR DELETE ON public.testimonials
  FOR EACH ROW EXECUTE FUNCTION public.log_content_change();

CREATE TRIGGER log_blog_posts_changes
  BEFORE UPDATE OR DELETE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.log_content_change();