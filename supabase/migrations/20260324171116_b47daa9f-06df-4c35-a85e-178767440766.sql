
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;
ALTER TABLE public.testimonials ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;
