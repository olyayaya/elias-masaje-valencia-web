
-- Create timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Services table
CREATE TABLE public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  duration TEXT NOT NULL,
  price TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Services are publicly readable" ON public.services FOR SELECT USING (true);
CREATE POLICY "Services are publicly writable" ON public.services FOR INSERT WITH CHECK (true);
CREATE POLICY "Services are publicly updatable" ON public.services FOR UPDATE USING (true);
CREATE POLICY "Services are publicly deletable" ON public.services FOR DELETE USING (true);
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Blog posts table
CREATE TABLE public.blog_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  seo_keywords TEXT[] NOT NULL DEFAULT '{}',
  meta_description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Blog posts are publicly readable" ON public.blog_posts FOR SELECT USING (true);
CREATE POLICY "Blog posts are publicly writable" ON public.blog_posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Blog posts are publicly updatable" ON public.blog_posts FOR UPDATE USING (true);
CREATE POLICY "Blog posts are publicly deletable" ON public.blog_posts FOR DELETE USING (true);
CREATE TRIGGER update_blog_posts_updated_at BEFORE UPDATE ON public.blog_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- FAQ table
CREATE TABLE public.faqs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "FAQs are publicly readable" ON public.faqs FOR SELECT USING (true);
CREATE POLICY "FAQs are publicly writable" ON public.faqs FOR INSERT WITH CHECK (true);
CREATE POLICY "FAQs are publicly updatable" ON public.faqs FOR UPDATE USING (true);
CREATE POLICY "FAQs are publicly deletable" ON public.faqs FOR DELETE USING (true);
CREATE TRIGGER update_faqs_updated_at BEFORE UPDATE ON public.faqs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Testimonials table
CREATE TABLE public.testimonials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  quote TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'Google',
  rating INTEGER NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Testimonials are publicly readable" ON public.testimonials FOR SELECT USING (true);
CREATE POLICY "Testimonials are publicly writable" ON public.testimonials FOR INSERT WITH CHECK (true);
CREATE POLICY "Testimonials are publicly updatable" ON public.testimonials FOR UPDATE USING (true);
CREATE POLICY "Testimonials are publicly deletable" ON public.testimonials FOR DELETE USING (true);
CREATE TRIGGER update_testimonials_updated_at BEFORE UPDATE ON public.testimonials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Media storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true);
CREATE POLICY "Media is publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'media');
CREATE POLICY "Anyone can upload media" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'media');
CREATE POLICY "Anyone can delete media" ON storage.objects FOR DELETE USING (bucket_id = 'media');

-- Seed initial services
INSERT INTO public.services (title, duration, price, description, sort_order) VALUES
  ('Masaje descontracturante', '60 min', '50 €', 'Trabajo profundo sobre nudos y tensiones musculares crónicas.', 0),
  ('Masaje relajante', '60 min', '45 €', 'Técnicas suaves para promover la calma y el descanso.', 1),
  ('Masaje deportivo', '45 min', '40 €', 'Preparación y recuperación muscular para deportistas.', 2);

-- Seed initial FAQs
INSERT INTO public.faqs (question, answer, sort_order) VALUES
  ('¿Necesito traer algo a la sesión?', 'No, solo necesitas venir con ropa cómoda. Todo lo demás lo proporciono yo.', 0),
  ('¿Cuánto dura una sesión?', 'Las sesiones duran entre 45 y 90 minutos dependiendo del tratamiento.', 1),
  ('¿Se puede cancelar o reprogramar?', 'Sí, con al menos 24 horas de antelación sin coste.', 2),
  ('¿Qué métodos de pago aceptáis?', 'Aceptamos efectivo, tarjeta y Bizum.', 3);

-- Seed initial testimonials
INSERT INTO public.testimonials (name, quote, source, rating) VALUES
  ('María López', 'Elías es un masajista increíble. Fui a él por un fuerte dolor de cuello.', 'Google', 5),
  ('Carlos Ruiz', 'Experiencia para repetir más de una vez. El espacio, el trato, su profesionalidad.', 'TripAdvisor', 5),
  ('Ana García', 'Gran profesional. Variedad de tratamientos adecuados para cada necesidad.', 'Google', 5);

-- Seed initial blog post
INSERT INTO public.blog_posts (title, content, seo_keywords, meta_description, status) VALUES
  ('Los beneficios del masaje regular', '<p>El masaje regular puede transformar tu bienestar...</p>', ARRAY['masaje Valencia', 'bienestar'], 'Descubre cómo el masaje regular puede mejorar tu salud y bienestar en Valencia.', 'published');
