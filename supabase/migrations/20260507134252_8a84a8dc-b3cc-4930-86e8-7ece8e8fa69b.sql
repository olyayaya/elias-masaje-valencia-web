INSERT INTO public.site_content (content_key, category, label, value_es, value_en, value_ru, sort_order)
VALUES
  ('contact_facebook_url', 'contact', 'Facebook URL', '', '', '', 7),
  ('contact_google_url', 'contact', 'Google Business URL', '', '', '', 8),
  ('contact_tripadvisor_url', 'contact', 'TripAdvisor URL', '', '', '', 9)
ON CONFLICT DO NOTHING;