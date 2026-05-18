DELETE FROM public.site_content WHERE content_key IN ('integration_bing_verification','integration_yandex_verification');

INSERT INTO public.site_content (category, content_key, value_es, value_en, value_ru)
VALUES
  ('integrations','integration_google_workspace_verification','','',''),
  ('integrations','integration_tripadvisor_url','','','')
ON CONFLICT (content_key) DO NOTHING;