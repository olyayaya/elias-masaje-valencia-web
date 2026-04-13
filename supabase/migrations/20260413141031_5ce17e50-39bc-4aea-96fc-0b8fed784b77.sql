-- Add published_at column for scheduled publishing
ALTER TABLE public.blog_posts 
ADD COLUMN published_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Set published_at for any existing published posts
UPDATE public.blog_posts SET published_at = created_at WHERE status = 'published' AND published_at IS NULL;

-- Add slug column for clean URLs
ALTER TABLE public.blog_posts
ADD COLUMN slug TEXT DEFAULT '';
