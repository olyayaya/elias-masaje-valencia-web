-- Least-privilege grant hardening for public schema.
-- TRUNCATE / TRIGGER / REFERENCES / MAINTAIN are NOT filtered by RLS, so they
-- must never be held by the anon or authenticated API roles.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('REVOKE TRUNCATE, TRIGGER, REFERENCES, MAINTAIN ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- Read-only-for-the-public tables: anon keeps SELECT only (RLS still applies).
REVOKE INSERT, UPDATE, DELETE ON public.services FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.testimonials FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.promotions FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.faqs FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.page_images FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.site_content FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.gallery_items FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.blog_posts FROM anon;

-- Admin-only tables: anon needs nothing at all.
REVOKE ALL ON public.user_roles FROM anon;
REVOKE ALL ON public.content_history FROM anon;
REVOKE ALL ON public.media_aliases FROM anon;
REVOKE SELECT, UPDATE, DELETE ON public.booking_leads FROM anon;   -- anon may only submit leads
REVOKE SELECT, UPDATE, DELETE ON public.conversion_events FROM anon; -- anon may only write events

-- Signed-in roles keep exactly what the admin RLS policies need.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.testimonials TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.faqs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_images TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_content TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gallery_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.review_display_settings TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.booking_leads TO authenticated;
GRANT SELECT ON public.conversion_events TO authenticated;
GRANT SELECT ON public.content_history TO authenticated;
GRANT SELECT ON public.media_aliases TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT ON public.services, public.testimonials, public.promotions, public.faqs,
                public.page_images, public.site_content, public.gallery_items,
                public.blog_posts, public.reviews, public.review_display_settings TO anon;
GRANT INSERT ON public.booking_leads TO anon;
GRANT INSERT ON public.conversion_events TO anon;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;