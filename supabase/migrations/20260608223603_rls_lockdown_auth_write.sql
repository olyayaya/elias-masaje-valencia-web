-- =============================================================================
-- RLS LOCKDOWN — restrict writes to the authenticated owner
-- =============================================================================
-- Until now every content table (and the `media` storage bucket) shipped
-- wide-open policies: anyone holding the publishable/anon key — which is in
-- every visitor's browser — could INSERT / UPDATE / DELETE. This migration
-- closes that hole.
--
-- End state:
--   • Content tables  -> PUBLIC may SELECT (read), only AUTHENTICATED may write.
--   • content_history -> only AUTHENTICATED may read (it's the edit log).
--                        Inserts keep flowing via the SECURITY DEFINER trigger
--                        `log_content_change()`, which bypasses RLS.
--   • conversion_events -> ANON may INSERT only (the public site logs WhatsApp
--                          / contact conversions write-only); only AUTHENTICATED
--                          may read. No update/delete.
--   • storage `media`  -> PUBLIC read, AUTHENTICATED write (upload/delete).
--
-- Reads stay public everywhere so the unauthenticated site keeps rendering.
-- Everything runs in one transaction, so there is no window where reads break.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Content tables: public read, authenticated write
-- (services, faqs, testimonials, promotions, site_content, page_images,
--  blog_posts)
-- -----------------------------------------------------------------------------

-- services -------------------------------------------------------------------
DROP POLICY IF EXISTS "Services are publicly readable"  ON public.services;
DROP POLICY IF EXISTS "Services are publicly writable"  ON public.services;
DROP POLICY IF EXISTS "Services are publicly updatable" ON public.services;
DROP POLICY IF EXISTS "Services are publicly deletable" ON public.services;
CREATE POLICY "services public read"          ON public.services FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "services authenticated insert" ON public.services FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "services authenticated update" ON public.services FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "services authenticated delete" ON public.services FOR DELETE TO authenticated USING (true);

-- faqs -----------------------------------------------------------------------
DROP POLICY IF EXISTS "FAQs are publicly readable"  ON public.faqs;
DROP POLICY IF EXISTS "FAQs are publicly writable"  ON public.faqs;
DROP POLICY IF EXISTS "FAQs are publicly updatable" ON public.faqs;
DROP POLICY IF EXISTS "FAQs are publicly deletable" ON public.faqs;
CREATE POLICY "faqs public read"          ON public.faqs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "faqs authenticated insert" ON public.faqs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "faqs authenticated update" ON public.faqs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "faqs authenticated delete" ON public.faqs FOR DELETE TO authenticated USING (true);

-- testimonials ---------------------------------------------------------------
DROP POLICY IF EXISTS "Testimonials are publicly readable"  ON public.testimonials;
DROP POLICY IF EXISTS "Testimonials are publicly writable"  ON public.testimonials;
DROP POLICY IF EXISTS "Testimonials are publicly updatable" ON public.testimonials;
DROP POLICY IF EXISTS "Testimonials are publicly deletable" ON public.testimonials;
CREATE POLICY "testimonials public read"          ON public.testimonials FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "testimonials authenticated insert" ON public.testimonials FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "testimonials authenticated update" ON public.testimonials FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "testimonials authenticated delete" ON public.testimonials FOR DELETE TO authenticated USING (true);

-- promotions -----------------------------------------------------------------
DROP POLICY IF EXISTS "Promotions are publicly readable"  ON public.promotions;
DROP POLICY IF EXISTS "Promotions are publicly writable"  ON public.promotions;
DROP POLICY IF EXISTS "Promotions are publicly updatable" ON public.promotions;
DROP POLICY IF EXISTS "Promotions are publicly deletable" ON public.promotions;
CREATE POLICY "promotions public read"          ON public.promotions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "promotions authenticated insert" ON public.promotions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "promotions authenticated update" ON public.promotions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "promotions authenticated delete" ON public.promotions FOR DELETE TO authenticated USING (true);

-- site_content ---------------------------------------------------------------
DROP POLICY IF EXISTS "Site content is publicly readable"  ON public.site_content;
DROP POLICY IF EXISTS "Site content is publicly writable"  ON public.site_content;
DROP POLICY IF EXISTS "Site content is publicly updatable" ON public.site_content;
DROP POLICY IF EXISTS "Site content is publicly deletable" ON public.site_content;
CREATE POLICY "site_content public read"          ON public.site_content FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "site_content authenticated insert" ON public.site_content FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "site_content authenticated update" ON public.site_content FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "site_content authenticated delete" ON public.site_content FOR DELETE TO authenticated USING (true);

-- page_images ----------------------------------------------------------------
DROP POLICY IF EXISTS "Page images are publicly readable"  ON public.page_images;
DROP POLICY IF EXISTS "Page images are publicly writable"  ON public.page_images;
DROP POLICY IF EXISTS "Page images are publicly updatable" ON public.page_images;
DROP POLICY IF EXISTS "Page images are publicly deletable" ON public.page_images;
CREATE POLICY "page_images public read"          ON public.page_images FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "page_images authenticated insert" ON public.page_images FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "page_images authenticated update" ON public.page_images FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "page_images authenticated delete" ON public.page_images FOR DELETE TO authenticated USING (true);

-- blog_posts -----------------------------------------------------------------
DROP POLICY IF EXISTS "Blog posts are publicly readable"  ON public.blog_posts;
DROP POLICY IF EXISTS "Blog posts are publicly writable"  ON public.blog_posts;
DROP POLICY IF EXISTS "Blog posts are publicly updatable" ON public.blog_posts;
DROP POLICY IF EXISTS "Blog posts are publicly deletable" ON public.blog_posts;
CREATE POLICY "blog_posts public read"          ON public.blog_posts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "blog_posts authenticated insert" ON public.blog_posts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "blog_posts authenticated update" ON public.blog_posts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "blog_posts authenticated delete" ON public.blog_posts FOR DELETE TO authenticated USING (true);

-- -----------------------------------------------------------------------------
-- content_history: edit log — authenticated read only.
-- Inserts come from the SECURITY DEFINER trigger log_content_change(), which
-- bypasses RLS, so no INSERT policy is required.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Content history is publicly readable" ON public.content_history;
DROP POLICY IF EXISTS "Content history is publicly writable" ON public.content_history;
CREATE POLICY "content_history authenticated read" ON public.content_history FOR SELECT TO authenticated USING (true);

-- -----------------------------------------------------------------------------
-- conversion_events: write-only logging from the public site; authenticated read.
-- The unauthenticated site INSERTs WhatsApp / contact conversions (see
-- src/lib/analytics.ts). Visitors must NOT be able to read everyone's
-- conversion data, so SELECT is authenticated-only. No update/delete.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Conversion events are publicly readable" ON public.conversion_events;
DROP POLICY IF EXISTS "Conversion events are publicly writable" ON public.conversion_events;
CREATE POLICY "conversion_events public insert"      ON public.conversion_events FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "conversion_events authenticated read" ON public.conversion_events FOR SELECT TO authenticated USING (true);

-- -----------------------------------------------------------------------------
-- Storage bucket `media`: public read, authenticated write.
-- Uploads use upsert:false with unique names, so no UPDATE policy is needed.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Media is publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload media"       ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete media"       ON storage.objects;
CREATE POLICY "media public read"          ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'media');
CREATE POLICY "media authenticated insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'media');
CREATE POLICY "media authenticated delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'media');

COMMIT;
