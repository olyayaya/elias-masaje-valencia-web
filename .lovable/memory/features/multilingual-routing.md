---
name: Multilingual Routing
description: URL-based locale routing with /en and /ru prefixes, eliasmas.es domain, route map in src/config/routes.ts
type: feature
---
Locale is determined by URL path prefix, not localStorage:
- Spanish (default): / /servicios /sobre-mi /contacto /blog
- English: /en /en/services /en/about /en/contact /en/blog
- Russian: /ru /ru/uslugi /ru/about /ru/contact /ru/blog

Primary domain: eliasmas.es (BASE_URL in src/config/routes.ts)
Route config: src/config/routes.ts (ROUTE_MAP, getAlternates, getEquivalentPath)
LocaleSync component syncs i18n context from URL on navigation.
useLocalePath() hook returns locale-aware paths for components.
LanguageSwitcher navigates to equivalent path in target locale.
All pages use hreflang alternates and locale-specific canonical URLs.
Sitemap at /sitemap.xml with full hreflang cross-references.
