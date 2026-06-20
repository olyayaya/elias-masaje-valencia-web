# Elias Masaje — Project Handover

_Last updated: 2026-06-20_

This document is the single source of truth for taking over the **Elias Masaje** website (eliasmas.es). It covers the tech stack, infrastructure, data model, deployment, third-party services, and day-to-day operations.

---

## Diagrams

The following Mermaid (`.mmd`) diagrams accompany this document and render in any Markdown viewer that supports Mermaid (GitHub, VS Code with the Mermaid extension, Obsidian, etc.):

- **`Architecture_Overview.mmd`** — system-wide view: browser → Lovable hosting/CDN → Lovable Cloud (Auth, Data API, Postgres, Storage, Edge Functions) → AI Gateway and third-party services.
- **`Data_Model_RLS.mmd`** — all `public` tables, the `user_roles` + `has_role()` RLS pattern, foreign keys, audit trail via `content_history`, and the `media` storage bucket.
- **`Auth_Flow.mmd`** — admin password-reset and dashboard authorization sequence (`/auth` → email → `/reset-password` → `has_role` check → `/dashboard`).
- **`Edge_Functions_Flow.mmd`** — which clients invoke which edge functions, and how each function talks to the database and the AI Gateway.

---



## 1. Product overview

A trilingual (ES / EN / RU) marketing website for **Elias Masaje**, a massage therapist in Valencia, Spain, with:

- Public marketing pages (home, services, about, contact, blog, privacy).
- A protected admin **Dashboard** for content management (services, FAQs, testimonials, promotions, blog, media, integrations, SEO, analytics).
- AI-assisted content authoring and blog generation.
- WhatsApp as the primary conversion channel (`+34 698 968 007`).

**URLs**
- Production (custom domain): https://eliasmas.es
- Lovable subdomain: https://elias-masaje-valencia-web.lovable.app
- Lovable project preview / editor: opened via the Lovable workspace.

---

## 2. Tech stack

| Layer | Tool |
|---|---|
| Build tool | **Vite 5** |
| Language | **TypeScript 5** |
| UI framework | **React 18** (functional components, hooks) |
| Routing | **react-router-dom v6** (`BrowserRouter`) |
| Styling | **Tailwind CSS v3** + `tailwindcss-animate` + `@tailwindcss/typography` |
| Component library | **shadcn/ui** (Radix UI primitives, in `src/components/ui/`) |
| Icons | `lucide-react` |
| Forms | `react-hook-form` + `zod` + `@hookform/resolvers` |
| Data fetching | `@tanstack/react-query` |
| Rich-text editor | `@tiptap/*` (used in dashboard blog editor) |
| Carousels | `embla-carousel-react` |
| Charts | `recharts` (dashboard analytics) |
| Toasts | `sonner` + Radix toast |
| Sanitization | `dompurify` (rendering blog HTML) |
| Backend SDK | `@supabase/supabase-js` v2 |
| Testing | `vitest` + `@testing-library/react` + Playwright (E2E) |

Hosting & ops:
- **Frontend hosting:** Lovable (auto-deployed; SPA fallback handled by hosting — no `_redirects` needed).
- **Backend (DB / Auth / Storage / Edge Functions):** **Lovable Cloud** (managed Supabase under the hood).
- **AI:** **Lovable AI Gateway** (`LOVABLE_API_KEY`) — no OpenAI/Anthropic keys needed.
- **CDN-hosted binary assets:** Lovable Assets (`/__l5e/assets-v1/{id}/{filename}`), referenced via `*.asset.json` pointer files.

---

## 3. Repository layout

```
.
├── index.html                  # Root HTML, favicon + OG meta tags, GA/GTM placeholders
├── public/
│   ├── _redirects              # (legacy; SPA fallback is automatic)
│   ├── favicon.png.asset.json  # CDN pointer
│   ├── og-image.png.asset.json # CDN pointer
│   └── site.webmanifest
├── src/
│   ├── App.tsx                 # Top-level providers + Routes
│   ├── main.tsx                # React entry
│   ├── index.css               # Tailwind layers + design-token CSS variables
│   ├── assets/                 # Brand photography & icons (JPG/PNG)
│   ├── components/
│   │   ├── ui/                 # shadcn primitives (button, dialog, etc.)
│   │   ├── dashboard/          # All admin dashboard panels
│   │   ├── organic/            # Decorative dividers / shapes
│   │   ├── Header.tsx, Footer.tsx, Layout.tsx, NavLink.tsx
│   │   ├── LanguageSwitcher.tsx, LocaleSync.tsx, LanguageSuggestionBanner.tsx
│   │   ├── ThemeSwitcher.tsx   # Light → Dark → Dark Gradient cycle
│   │   ├── ProtectedRoute.tsx  # Auth + admin role gate
│   │   ├── ConsentBanner.tsx, PageTracker.tsx  # GA/GTM consent + page views
│   │   ├── ServiceCard, TestimonialCard, FaqAccordion, MapBlock, WhatsAppButton, ...
│   ├── config/
│   │   └── features.ts         # Feature flags
│   ├── contexts/               # Theme, language, etc.
│   ├── hooks/
│   │   ├── use-auth.ts         # Auth state + role check
│   │   ├── use-db-content.ts   # Reads site_content / services / faqs / testimonials / promotions
│   │   ├── use-head.ts         # Sets <title>, meta, JSON-LD (SEO helper)
│   │   └── ...
│   ├── i18n/                   # ES / EN / RU dictionaries (es.ts, en.ts, ru.ts, dashboard.ts, types.ts)
│   ├── integrations/supabase/
│   │   ├── client.ts           # Pre-configured Supabase client (DO NOT EDIT — auto-generated)
│   │   └── types.ts            # DB types (auto-generated)
│   ├── lib/                    # Shared utilities (cn, formatters, sanitizer wrappers)
│   ├── pages/                  # Route components
│   └── test/                   # Vitest setup + unit tests
├── supabase/
│   ├── config.toml             # Edge function settings (auto-generated; do not hand-edit project settings)
│   ├── functions/              # Deno edge functions (see §6)
│   └── migrations/             # SQL migrations, applied in filename order
├── package.json
├── tailwind.config.ts
├── vite.config.ts
└── HANDOVER.md                 # ← this file
```

**Do-not-edit files** (regenerated by Lovable Cloud):
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`
- `.env` keys: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
- `supabase/config.toml` (project-level settings)

---

## 4. Routing

Defined in `src/App.tsx`. Three localized URL trees plus auth + dashboard:

| Locale | Home | Services | About | Contact | Blog | Privacy |
|---|---|---|---|---|---|---|
| ES (default) | `/` | `/servicios` | `/sobre-mi` | `/contacto` | `/blog` `/blog/:slug` | `/privacidad` |
| EN | `/en` | `/en/services` | `/en/about` | `/en/contact` | `/en/blog` `/en/blog/:slug` | `/en/privacy` |
| RU | `/ru` | `/ru/uslugi` | `/ru/about` | `/ru/contact` | `/ru/blog` `/ru/blog/:slug` | `/ru/privacy` |

Auth & admin:
- `/auth` — sign in + “Forgot password?” + in-app reset guide.
- `/reset-password` — public; consumes the `type=recovery` hash and sets a new password.
- `/dashboard` — protected by `<ProtectedRoute>` (requires authenticated session **and** `user_roles.role = 'admin'`).
- `/analytics-check` — small debugging page for GA4 / GTM integration sanity.

Catch-all: `<NotFound />`. SPA fallback is handled by Lovable hosting automatically.

---

## 5. Data model (Supabase / Lovable Cloud)

All tables live in `public`. RLS is enabled on every table, and grants are issued in the same migration as the `CREATE TABLE`. Roles are stored in a **separate** `user_roles` table (not on profiles) and checked through the `public.has_role()` security-definer function — this prevents recursive RLS and privilege escalation.

| Table | Purpose |
|---|---|
| `services` | Massage services (name, duration, price, description, image, ordering). Trilingual columns. |
| `site_content` | Page-section content keyed by `(page, section)` — hero copy, about text, etc. Trilingual. |
| `faqs` | FAQ entries per page. Trilingual. |
| `testimonials` | Client testimonials (name, text, rating). |
| `promotions` | Promotional badges attached to services (with text per language, breathing pulse). |
| `blog_posts` | Blog posts (title, slug, content HTML, excerpt, cover image, status, published_at, SEO meta). Trilingual. |
| `page_images` | Per-page image overrides with focal-point editor data. |
| `conversion_events` | WhatsApp / CTA click tracking. |
| `content_history` | Audit log written by `log_content_change()` trigger on update/delete. |
| `user_roles` | `(user_id, role app_role)` — `role` ∈ `admin | moderator | user`. |

DB functions:
- `public.has_role(_user_id uuid, _role app_role) → boolean` — security-definer, used in RLS policies.
- `public.handle_new_user_bootstrap_admin()` — trigger that grants `admin` to the **first** signed-up user only (so the very first sign-in self-bootstraps).
- `public.log_content_change()` — trigger writing snapshots into `content_history`.
- `public.update_updated_at_column()` — generic `updated_at` maintenance.

All schema changes live in `supabase/migrations/` and are applied in lexical order. **Never** edit an already-applied migration; create a new one.

Storage:
- Single public bucket: **`media`** — used by the dashboard Media library and ImagePicker. Images are resized client-side to max 1920px and converted server-side to WebP @ 82%.

---

## 6. Edge functions (`supabase/functions/`)

All run on Deno and use `LOVABLE_API_KEY` for AI calls. They deploy automatically on push.

| Function | Purpose | Auth |
|---|---|---|
| `ai-content-helper` | Admin-only helper that drafts / translates / improves site copy via Lovable AI Gateway. | Requires authenticated admin (JWT). |
| `blog-generator` | Admin-only blog post generation (title → full post in ES/EN/RU with SEO metadata). | Requires authenticated admin. |
| `sitemap` | Generates `/sitemap.xml` dynamically from `blog_posts` + static routes. | Public. |
| `robots` | Serves `/robots.txt`. | Public. |
| `llms` | Serves `/llms.txt` for LLM crawlers. | Public. |
| `test-integration` | Sanity-check endpoint used by the dashboard “Integrations” panel. | Public (no secrets exposed). |

---

## 7. Authentication & authorization

- **Provider:** Lovable Cloud (Supabase Auth).
- **Methods enabled:** Email + password. (No social providers configured — add via the Cloud → Users → Providers panel if needed.)
- **Anonymous sign-ups:** disabled.
- **Email confirmation:** required (custom auth email templates can be added via Lovable Email if desired).
- **Admin accounts (pre-seeded):**
  - `ilaylightman@gmail.com`
  - `olgaandrosik@gmail.com`

  They were created server-side without passwords. To get in, use the **“Forgot your password?”** flow on `/auth` — the in-app help panel on that page explains the 5 steps.
- **Bootstrap rule:** the very first user to sign up is automatically granted the `admin` role by the `handle_new_user_bootstrap_admin` trigger. Subsequent users start with no role and must be granted `admin` manually via SQL:

  ```sql
  insert into public.user_roles (user_id, role)
  select id, 'admin' from auth.users where email = 'someone@example.com';
  ```

- **Frontend gate:** `<ProtectedRoute>` in `src/components/ProtectedRoute.tsx` checks session + role before rendering the dashboard.
- **Session handling:** `src/hooks/use-auth.ts` registers `onAuthStateChange` and calls `getUser()` for any trust-sensitive check.

---

## 8. Secrets & environment

Secrets are stored in Lovable Cloud (Supabase Edge Function Secrets), **not** in `.env`. Currently configured:

| Secret | Owner | Notes |
|---|---|---|
| `LOVABLE_API_KEY` | Lovable-managed | Powers AI Gateway calls from edge functions. Rotate via Lovable tooling, not as a regular secret. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY(S)`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEYS`, `SUPABASE_JWKS`, `SUPABASE_DB_URL` | Lovable-managed | Auto-injected into edge functions. **Service-role key and DB password are not exposed in the Lovable Cloud UI** — never reference them in client code. |

`.env` (client-side, safe to commit) holds the publishable anon key and Supabase project URL only.

---

## 9. Internationalization (i18n)

- Dictionaries in `src/i18n/{es,en,ru}.ts`, dashboard strings in `dashboard.ts`, types in `types.ts`.
- Default language: **ES**. Language is inferred from URL prefix (`/en`, `/ru`, otherwise ES).
- `LocaleSync` updates `<html lang>` and persists user preference.
- `LanguageSuggestionBanner` offers to switch language based on browser `navigator.language`.
- All UI **must accommodate longer Russian strings** (memory rule); content tables (services, FAQs, blog) all have per-language columns with EN/RU falling back to ES when blank.

---

## 10. Design system

- Theme cycle: **Light → Dark → Dark Gradient (Sparkles)**. Implemented in `ThemeSwitcher.tsx` + CSS variables in `src/index.css`.
- Typography: **Poiret One** (headlines), **Montserrat** (body/UI). Both with full Cyrillic support.
- Aesthetic: “warm minimalism, ambient glow”. Half-moon SVG dividers between major sections, breathing animations (~18s), opacity-only transitions to avoid layout shifts.
- All colors, gradients, shadows are **semantic design tokens** in `src/index.css` — never hardcode Tailwind color utilities like `text-white` in components.
- Project memory rules (see `mem://index.md`) govern fine-grained design decisions; honor them when making changes.

---

## 11. SEO

- `src/hooks/use-head.ts` sets `<title>`, meta description, OG/Twitter tags, and JSON-LD per route.
- Localized JSON-LD with fixed aggregate ratings.
- `/sitemap.xml` and `/robots.txt` served by edge functions and refreshed on every blog publish.
- `/llms.txt` served for LLM crawlers.
- Favicon + 1200×630 OG share graphic are CDN-hosted brand assets (see `public/*.asset.json`).

---

## 12. Analytics & tracking

Configured per-environment from the dashboard **Integrations** panel; values stored in `site_content` and injected into `index.html` at runtime:

- Google Analytics 4 (measurement ID `G-XXXXXXXXXX`).
- Google Tag Manager (`GTM-XXXXXXX`).
- Google Search Console verification meta tag.
- `ConsentBanner` + `PageTracker` handle GDPR consent and SPA page-view tracking.
- `conversion_events` table records WhatsApp clicks and other CTAs.
- `/analytics-check` page surfaces current configuration for debugging.

---

## 13. Local development

```bash
# Prereqs: Node 20+, bun (or npm/pnpm), git
bun install            # or npm install
bun run dev            # Vite on http://localhost:8080
bun run test           # vitest
bun run lint
bun run build          # production build
```

The Supabase URL + anon key in `.env` point at the **shared Lovable Cloud project** — local dev hits the same database as production. Be careful when writing data. For a true isolated environment, create a second Lovable project and copy the schema via migrations.

---

## 14. Deployment

- **Frontend:** click **Publish** in the Lovable editor (top-right). Frontend changes require an explicit publish to go live.
- **Backend (edge functions, DB migrations):** deployed automatically when changes are committed in Lovable.
- **Custom domain (`eliasmas.es`):** managed in Lovable → Project Settings → Domains. DNS records point at Lovable’s edge.

Rollback: the project keeps version history — use Lovable’s chat history to revert to a previous commit/version.

---

## 15. Day-to-day operations

| Task | Where |
|---|---|
| Add/edit a service, FAQ, testimonial | `/dashboard` → respective tab |
| Write a blog post (with AI assist + auto-translation) | `/dashboard` → Blog |
| Upload images | `/dashboard` → Media (stores in `media` bucket, auto-converts to WebP) |
| Reorder hero / about copy | `/dashboard` → Site Content |
| Run a promotion badge | `/dashboard` → Promotions |
| Update analytics IDs / tracking pixels | `/dashboard` → Integrations |
| Review SEO meta / JSON-LD | `/dashboard` → SEO |
| See change history | `/dashboard` → History (reads `content_history`) |
| Add a new admin | SQL insert into `user_roles` (see §7) |

---

## 16. Known constraints & gotchas

- **Never edit `src/integrations/supabase/{client,types}.ts`** — regenerated by Lovable Cloud.
- **Never `ALTER DATABASE postgres`** in a migration — Lovable Cloud rejects it.
- **Service role key is unavailable** in client code and not retrievable from the Lovable UI; do all privileged work in edge functions where it’s injected automatically.
- **Public bucket `media`** — anything uploaded is publicly readable by URL. Don’t put private files there.
- **First-user-is-admin trigger** means a brand-new clone of this project will hand admin to whoever signs up first. Remove or harden the trigger if you ever migrate the database to a new tenant.
- **Tailwind v3** — do not upgrade to v4 without auditing the design tokens in `index.css`.
- **Layout rule:** internal pages need `pt-32` to `pt-44` because the header is `fixed` outside `.ambient-glow`.

---

## 17. Useful commands

```bash
# Tail recent edge function logs (Lovable Cloud)
#   – use the Lovable dashboard → Cloud → Functions → Logs

# Apply a new migration
#   – create a new file under supabase/migrations/<timestamp>_<name>.sql
#   – Lovable Cloud auto-applies on commit

# Regenerate TS DB types after schema change
#   – happens automatically on commit; do not hand-edit src/integrations/supabase/types.ts
```

---

## 18. Contacts & external accounts

- **Business owner:** Elias (Elias Masaje, Valencia, Spain).
- **WhatsApp:** +34 698 968 007.
- **Lovable workspace:** access managed via Lovable → Share menu.
- **Domain registrar / DNS:** (record here when handing over) — DNS for `eliasmas.es` points at Lovable’s hosting.
- **Google Analytics / Search Console:** configured via dashboard Integrations panel; ensure the new owner is granted access in the Google admin consoles.

---

## 19. Handover checklist for the incoming maintainer

- [ ] Granted access to the Lovable workspace (Editor role).
- [ ] Added to Google Analytics 4 + Search Console as admin.
- [ ] Given access to the domain registrar / DNS provider.
- [ ] Signed in at `/auth` and reset password (admin role auto-applies via `user_roles`).
- [ ] Verified they can publish a small change end-to-end (edit → publish → see on `eliasmas.es`).
- [ ] Read this document and `mem://index.md` (project memory / design rules).

---

_End of handover document._
