Design system and project constraints for Elias Masaje Valencia website.

Chat language: English. Site languages: Spanish, Russian, English (multilingual support needed).
Theme system: Light (warm beige spa) + Dark (charcoal espresso) modes with system preference detection and manual toggle.
Light mode: warm cream/sand backgrounds, soft charcoal text, muted gold accents.
Dark mode: deep charcoal/espresso backgrounds, warm light text, muted warm gold accents.
All pages use Organic Editorial layout (OrganicHome/Services/About/Contact). Theme toggle (sun/moon) in bottom-left corner.
Font families set via CSS variables (--font-display, --font-body).
Font preview page at /font-preview with 3 options: Classic Editorial, Modern Wellness, Refined Elegance.
Dashboard at /dashboard — no auth, standalone CMS. Primary sections always visible; secondary (promotions, SEO, history) in collapsible "More" group.
Backend: Lovable Cloud (Supabase). Tables: services, blog_posts, faqs, testimonials, site_content, promotions, content_history. Storage bucket: media.
Public site reads from DB with i18n fallback (useDbServices, useDbFaqs, useDbTestimonials hooks).
RLS: fully permissive (no auth yet). Add auth later to lock down write access.
Mobile menu overlay: starts at top-16 (below header), 40% black + blur on page content only.
SEO: JSON-LD structured data (HealthAndBeautyBusiness), canonical tag, semantic headings.
Footer uses design tokens (bg-card, text-muted-foreground) — adapts to both light/dark modes.
Testimonials use bg-secondary/60 with soft border for gentle blending.
