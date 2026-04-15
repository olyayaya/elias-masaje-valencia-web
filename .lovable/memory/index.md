# Project Memory

## Core
- Theme cycle: Light → Dark → Dark Gradient (Sparkles). Warm minimalism, ambient glow.
- Typography: Poiret One (headlines), Montserrat (body/UI). Must support Cyrillic.
- Multilingual: ES/EN/RU. URL-based routing (/en, /ru prefixes). Domain: eliasmas.es
- Layout: Fixed top components outside `.ambient-glow`. Internal pages use `pt-32` to `pt-44`.
- Transitions: Avoid layout shifts. Use opacity-only animations (no vertical transforms) for FAQs.
- Content: WhatsApp +34698968007. Elias Masaje. All external links use `target="_blank"`.

## Memories
- [Visual Identity](mem://style/visual-identity) — Ambient glow system, warm minimalism, 18s breathing animations
- [Color Palette](mem://style/color-palette) — 3-mode theme system, warm neutral tones, semantic card surfaces
- [Typography](mem://style/typography) — Poiret One and Montserrat locked system, full Cyrillic support
- [Multilingual](mem://features/multilingual) — ES, EN, RU support and dashboard dynamic UI labels
- [Multilingual Routing](mem://features/multilingual-routing) — URL-based locale routing, eliasmas.es domain, route map config
- [Promotions](mem://features/promotions) — 3s breathing pulse badges, dashboard management system
- [Maps Integration](mem://features/maps-integration) — Google/Apple Maps picker overlay on contact page
- [Mobile Experience](mem://ui/mobile-experience) — Full-bleed 9/8 images with half-moon mask SVG dividers
- [Dashboard UX](mem://ui/dashboard-ux) — Image picker with 3x3 focal point editor and aspect ratio preview
- [Theme System](mem://style/theme-system) — Light → Dark → Dark Gradient cycle, manual and system toggles
- [Conversion Flow](mem://features/conversion-flow) — 'Ready to feel better?' CTA before footer linking to WhatsApp
- [SEO Structure](mem://features/seo-structure) — Custom useHead hook, localized JSON-LD schemas and fixed ratings
- [Blog](mem://features/blog) — AI CMS generation, auto-save translation fallbacks, ES/EN/RU
- [Contact Details](mem://config/contact-details) — Business address, coordinates, and social profiles
- [Media Library](mem://features/media-library) — Client-side resize (1920px), server-side WebP 82% conversion
- [Layout Structure](mem://ui/layout-structure) — Fixed top elements, z-index rules, top padding for internal pages
- [Section Transitions](mem://style/section-transitions) — Decorative half-moon dividers, dark gradient transparent fills
- [Footer Layout](mem://ui/footer-layout) — Integrated -top-16 half-moon SVG divider, solid card surface
- [FAQ Styling](mem://ui/faq-styling) — Solid background, opacity changes only to avoid z-index stacking conflicts
