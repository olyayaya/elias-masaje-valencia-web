INSERT INTO public.site_content (content_key, value_es, value_en, value_ru, category, label, sort_order)
SELECT 'integration_sentry_dsn', '', '', '', 'integrations', 'Sentry — Error reporting DSN', 60
WHERE NOT EXISTS (SELECT 1 FROM public.site_content WHERE content_key = 'integration_sentry_dsn');