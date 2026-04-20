INSERT INTO public.site_content (content_key, category, label, sort_order, value_es, value_en, value_ru)
VALUES (
  'sitemap_config',
  'seo',
  'Sitemap extra URLs (JSON)',
  2,
  E'{\n  "extraUrls": []\n}',
  '',
  ''
)
ON CONFLICT (content_key) DO NOTHING;