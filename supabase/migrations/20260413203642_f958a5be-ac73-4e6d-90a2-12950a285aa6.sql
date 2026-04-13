ALTER TABLE public.blog_posts ADD COLUMN seo_keywords_en text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.blog_posts ADD COLUMN seo_keywords_ru text[] NOT NULL DEFAULT '{}'::text[];
-- Seed existing posts: copy seo_keywords to both language columns
UPDATE public.blog_posts SET seo_keywords_en = seo_keywords, seo_keywords_ru = seo_keywords;