
CREATE TABLE public.site_content (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_key text NOT NULL UNIQUE,
  value_es text NOT NULL DEFAULT '',
  value_en text NOT NULL DEFAULT '',
  value_ru text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  label text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Site content is publicly readable" ON public.site_content FOR SELECT TO public USING (true);
CREATE POLICY "Site content is publicly writable" ON public.site_content FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Site content is publicly updatable" ON public.site_content FOR UPDATE TO public USING (true);

CREATE TRIGGER update_site_content_updated_at BEFORE UPDATE ON public.site_content FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default content
INSERT INTO public.site_content (content_key, category, label, value_es, value_en, value_ru, sort_order) VALUES
  ('contact_address', 'contact', 'Address', 'Calle de la Paz 18, bajo derecha, Valencia', '18 Calle de la Paz, ground floor right, Valencia', 'Улица де ла Пас 18, нижний правый, Валенсия', 1),
  ('contact_weekdays', 'contact', 'Weekday Hours', 'Lunes a Viernes: 10:00 – 20:00', 'Monday to Friday: 10:00 – 20:00', 'Понедельник – Пятница: 10:00 – 20:00', 2),
  ('contact_saturday', 'contact', 'Saturday Hours', 'Sábado: 10:00 – 14:00', 'Saturday: 10:00 – 14:00', 'Суббота: 10:00 – 14:00', 3),
  ('contact_sunday', 'contact', 'Sunday Hours', 'Domingo: Cerrado', 'Sunday: Closed', 'Воскресенье: Закрыто', 4),
  ('contact_whatsapp', 'contact', 'WhatsApp Number', '34698968007', '34698968007', '34698968007', 5),
  ('contact_instagram', 'contact', 'Instagram Handle', '@elias_masaje', '@elias_masaje', '@elias_masaje', 6),
  ('hero_headline', 'hero', 'Hero Headline', 'Tu cuerpo merece atención experta', 'Your body deserves expert care', 'Ваше тело заслуживает экспертного ухода', 1),
  ('hero_subheadline', 'hero', 'Hero Subheadline', 'Masaje terapéutico profesional en el corazón de Valencia', 'Professional therapeutic massage in the heart of Valencia', 'Профессиональный терапевтический массаж в сердце Валенсии', 2),
  ('hero_cta', 'hero', 'Hero CTA Button', 'Reservar cita', 'Book appointment', 'Записаться', 3),
  ('final_cta_title', 'cta', 'Final CTA Title', '¿Listo para sentirte mejor?', 'Ready to feel better?', 'Готовы почувствовать себя лучше?', 1),
  ('final_cta_description', 'cta', 'Final CTA Description', 'Reserva tu sesión y empieza a cuidarte hoy', 'Book your session and start taking care of yourself today', 'Запишитесь на сеанс и начните заботиться о себе сегодня', 2),
  ('final_cta_button', 'cta', 'Final CTA Button', 'Reservar por WhatsApp', 'Book via WhatsApp', 'Записаться через WhatsApp', 3),
  ('gift_card_title', 'cta', 'Gift Card Title', '¿Buscas el regalo perfecto?', 'Looking for the perfect gift?', 'Ищете идеальный подарок?', 4),
  ('gift_card_description', 'cta', 'Gift Card Description', 'Regala bienestar con una tarjeta regalo de masaje', 'Give wellness with a massage gift card', 'Подарите здоровье с подарочной картой на массаж', 5),
  ('gift_card_cta', 'cta', 'Gift Card CTA', 'Pedir tarjeta regalo', 'Request gift card', 'Заказать подарочную карту', 6),
  ('about_preview_p1', 'about', 'About Preview Paragraph 1', 'Con más de 10 años de experiencia en masaje terapéutico, me especializo en técnicas que combinan tradición y ciencia moderna.', 'With over 10 years of experience in therapeutic massage, I specialize in techniques that combine tradition and modern science.', 'Более 10 лет опыта в терапевтическом массаже, я специализируюсь на техниках, сочетающих традиции и современную науку.', 1),
  ('about_preview_p2', 'about', 'About Preview Paragraph 2', 'Mi enfoque se centra en entender las necesidades únicas de cada persona para ofrecer un tratamiento verdaderamente personalizado.', 'My approach focuses on understanding each person''s unique needs to offer a truly personalized treatment.', 'Мой подход направлен на понимание уникальных потребностей каждого человека для предоставления по-настоящему индивидуального лечения.', 2),
  ('footer_tagline', 'footer', 'Footer Tagline', 'Masaje terapéutico profesional en Valencia. Tu bienestar, nuestra prioridad.', 'Professional therapeutic massage in Valencia. Your well-being, our priority.', 'Профессиональный терапевтический массаж в Валенсии. Ваше благополучие — наш приоритет.', 1),
  ('location_title', 'location', 'Location Section Title', 'Encuéntranos', 'Find Us', 'Найдите нас', 1);
