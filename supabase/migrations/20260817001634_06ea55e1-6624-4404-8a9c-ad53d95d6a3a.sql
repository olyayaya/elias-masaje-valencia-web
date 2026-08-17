DELETE FROM public.site_content
WHERE content_key = 'integration_seo_api_key'
  AND coalesce(value_es,'') = ''
  AND coalesce(value_en,'') = ''
  AND coalesce(value_ru,'') = '';