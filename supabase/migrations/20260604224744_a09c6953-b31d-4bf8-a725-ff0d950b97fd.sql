
-- =========================================================
-- Roles + admin allowlist
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE POLICY "Users can read their own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- First signed-up user automatically becomes admin (bootstrap)
CREATE OR REPLACE FUNCTION public.handle_new_user_bootstrap_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user_bootstrap_admin() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created_bootstrap_admin
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_bootstrap_admin();

-- =========================================================
-- Lock down EXECUTE on existing SECURITY DEFINER fns
-- =========================================================
REVOKE EXECUTE ON FUNCTION public.log_content_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- =========================================================
-- Replace all permissive write policies with admin-only
-- Keep SELECT public for content tables
-- =========================================================

-- services
DROP POLICY IF EXISTS "Services are publicly writable" ON public.services;
DROP POLICY IF EXISTS "Services are publicly updatable" ON public.services;
DROP POLICY IF EXISTS "Services are publicly deletable" ON public.services;
CREATE POLICY "Admins manage services" ON public.services
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- blog_posts
DROP POLICY IF EXISTS "Blog posts are publicly writable" ON public.blog_posts;
DROP POLICY IF EXISTS "Blog posts are publicly updatable" ON public.blog_posts;
DROP POLICY IF EXISTS "Blog posts are publicly deletable" ON public.blog_posts;
CREATE POLICY "Admins manage blog posts" ON public.blog_posts
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- faqs
DROP POLICY IF EXISTS "FAQs are publicly writable" ON public.faqs;
DROP POLICY IF EXISTS "FAQs are publicly updatable" ON public.faqs;
DROP POLICY IF EXISTS "FAQs are publicly deletable" ON public.faqs;
CREATE POLICY "Admins manage faqs" ON public.faqs
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- testimonials
DROP POLICY IF EXISTS "Testimonials are publicly writable" ON public.testimonials;
DROP POLICY IF EXISTS "Testimonials are publicly updatable" ON public.testimonials;
DROP POLICY IF EXISTS "Testimonials are publicly deletable" ON public.testimonials;
CREATE POLICY "Admins manage testimonials" ON public.testimonials
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- site_content
DROP POLICY IF EXISTS "Site content is publicly writable" ON public.site_content;
DROP POLICY IF EXISTS "Site content is publicly updatable" ON public.site_content;
CREATE POLICY "Admins manage site content" ON public.site_content
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- promotions
DROP POLICY IF EXISTS "Promotions are publicly writable" ON public.promotions;
DROP POLICY IF EXISTS "Promotions are publicly updatable" ON public.promotions;
DROP POLICY IF EXISTS "Promotions are publicly deletable" ON public.promotions;
CREATE POLICY "Admins manage promotions" ON public.promotions
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- page_images
DROP POLICY IF EXISTS "Page images are publicly writable" ON public.page_images;
DROP POLICY IF EXISTS "Page images are publicly updatable" ON public.page_images;
DROP POLICY IF EXISTS "Page images are publicly deletable" ON public.page_images;
CREATE POLICY "Admins manage page images" ON public.page_images
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- content_history: admin read only; trigger inserts run as SECURITY DEFINER so no INSERT policy needed
DROP POLICY IF EXISTS "Content history is publicly readable" ON public.content_history;
DROP POLICY IF EXISTS "Content history is publicly writable" ON public.content_history;
CREATE POLICY "Admins read content history" ON public.content_history
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- conversion_events: keep public INSERT (analytics tracking from anon visitors),
-- restrict SELECT to admins only
DROP POLICY IF EXISTS "Conversion events are publicly readable" ON public.conversion_events;
CREATE POLICY "Admins read conversion events" ON public.conversion_events
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- Storage: media bucket — admin-only write/delete, public read
-- =========================================================
DROP POLICY IF EXISTS "Anyone can upload media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete media" ON storage.objects;

CREATE POLICY "Admins can upload media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update media"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'media' AND public.has_role(auth.uid(), 'admin'));
