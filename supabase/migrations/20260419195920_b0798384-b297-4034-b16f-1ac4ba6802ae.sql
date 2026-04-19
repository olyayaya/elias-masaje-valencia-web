-- Seed the robots.txt body in site_content so it can be edited from the dashboard.
-- Uses value_es as the canonical store (robots.txt is locale-independent).
INSERT INTO public.site_content (content_key, category, label, sort_order, value_es, value_en, value_ru)
VALUES (
  'robots_txt',
  'seo',
  'robots.txt content',
  1,
  E'User-agent: Googlebot\nAllow: /\n\nUser-agent: Bingbot\nAllow: /\n\nUser-agent: Twitterbot\nAllow: /\n\nUser-agent: facebookexternalhit\nAllow: /\n\nUser-agent: *\nAllow: /\n\nSitemap: https://eliasmas.es/sitemap.xml\n',
  '',
  ''
)
ON CONFLICT (content_key) DO NOTHING;