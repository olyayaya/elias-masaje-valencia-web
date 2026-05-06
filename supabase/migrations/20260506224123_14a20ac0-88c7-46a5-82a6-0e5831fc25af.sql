-- Carousel images: ordered list of images per "collection" (e.g. home_carousel, about_carousel)
CREATE TABLE public.page_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_key TEXT NOT NULL,
  image_url TEXT NOT NULL,
  alt_text TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_page_images_collection ON public.page_images(collection_key, sort_order);

ALTER TABLE public.page_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Page images are publicly readable" ON public.page_images FOR SELECT USING (true);
CREATE POLICY "Page images are publicly writable" ON public.page_images FOR INSERT WITH CHECK (true);
CREATE POLICY "Page images are publicly updatable" ON public.page_images FOR UPDATE USING (true);
CREATE POLICY "Page images are publicly deletable" ON public.page_images FOR DELETE USING (true);

CREATE TRIGGER update_page_images_updated_at
BEFORE UPDATE ON public.page_images
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Track changes in history
CREATE TRIGGER log_page_images_changes
AFTER UPDATE OR DELETE ON public.page_images
FOR EACH ROW EXECUTE FUNCTION public.log_content_change();