Design system and project constraints for Elias Masaje Valencia website.

Chat language: English. Site languages: Spanish, Russian, English (multilingual support needed).
All themes use the Organic Editorial layout (OrganicHome/Services/About/Contact). Theme switcher only changes CSS variables (colors, fonts, shadows).
Themes: warm, clinical, natural, editorial, organic — each with --organic-dark, --font-display, --font-body.
Font families set via CSS variables, not hardcoded in tailwind.config.ts.
Dashboard at /dashboard — no auth, standalone CMS for managing services, blog, SEO, media, FAQ, testimonials.
Backend: Lovable Cloud (Supabase). Tables: services, blog_posts, faqs, testimonials. Storage bucket: media.
Public site reads from DB with i18n fallback (useDbServices, useDbFaqs, useDbTestimonials hooks).
RLS: fully permissive (no auth yet). Add auth later to lock down write access.
Mobile menu overlay: starts at top-16 (below header), 40% black + blur on page content only.
