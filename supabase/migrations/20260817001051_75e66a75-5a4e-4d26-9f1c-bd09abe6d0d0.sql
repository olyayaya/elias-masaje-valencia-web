DROP POLICY IF EXISTS "Blog posts are publicly readable" ON public.blog_posts;

CREATE POLICY "Published blog posts are publicly readable"
ON public.blog_posts
FOR SELECT
TO anon, authenticated
USING (
  status = 'published'
  AND hidden = false
  AND published_at IS NOT NULL
  AND published_at <= now()
);

CREATE POLICY "Admins read all blog posts"
ON public.blog_posts
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));