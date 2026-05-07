INSERT INTO public.site_content (content_key, value_es, value_en, value_ru, category, label, sort_order)
VALUES
  ('integration_ga4_id',            '', '', '', 'integrations', 'Google Analytics 4 Measurement ID', 1),
  ('integration_gtm_id',            '', '', '', 'integrations', 'Google Tag Manager Container ID',   2),
  ('integration_gsc_verification',  '', '', '', 'integrations', 'Google Search Console verification', 3),
  ('integration_bing_verification', '', '', '', 'integrations', 'Bing Webmaster verification',       4),
  ('integration_yandex_verification','', '', '', 'integrations', 'Yandex Webmaster verification',    5),
  ('integration_seo_api_key',       '', '', '', 'integrations', 'SEO tool API key',                  6)
ON CONFLICT (content_key) DO NOTHING;