# Elias Masaje — eliasmas.es

Marketing site and dashboard CMS for **Elias Masaje**, a professional
massage practice in central Valencia. Built with Vite, React, TypeScript,
Tailwind, shadcn/ui and Supabase.

## Stack

- **Frontend**: Vite 5 + React 18 + TypeScript, React Router, Tailwind, shadcn/ui
- **Data**: Supabase (Postgres + edge functions + storage)
- **State**: TanStack Query (React Query)
- **i18n**: custom locale context, URL-prefix routing (`/`, `/en`, `/ru`)
- **Tests**: Vitest + Testing Library
- **Editor**: TipTap (blog rich text)

## Getting started

```bash
npm install
cp .env.example .env   # fill in your Supabase project URL + anon key
npm run dev            # starts on http://localhost:8080
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local dev server (Vite) |
| `npm run build` | Production build |
| `npm run preview` | Serve the built `dist/` locally |
| `npm run lint` | ESLint over `src/` and config |
| `npm test` | Run Vitest unit tests once |
| `npm run test:watch` | Vitest in watch mode |

## Project layout

```
src/
  pages/                # Routed page components
  components/           # Shared UI + dashboard editors
  components/dashboard/ # CMS editors (services, FAQ, blog, …)
  components/organic/   # Public-page sections
  hooks/                # React hooks (Supabase reads via React Query)
  i18n/                 # ES / EN / RU translations + context
  integrations/supabase # Generated Supabase client + types
  lib/                  # Pure utilities (analytics, format-price, query-keys)
  config/               # Route + contact constants
supabase/
  functions/            # Deno edge functions (AI, sitemap, robots, …)
  migrations/           # Database migrations
```

## Editing content

The `/dashboard` route is the CMS. Each editor (Services, FAQ, Blog, …)
writes to the matching Supabase table and invalidates the React Query key
that the public site reads from, so edits appear without a hard refresh.

`src/lib/query-keys.ts` is the single source of truth for query keys.

## i18n

- Locale is derived from the URL prefix: `/` → ES, `/en` → EN, `/ru` → RU.
- `LocaleSync` keeps the active locale in step with the URL.
- DB content (`services_*_en`, `value_ru`, …) falls back to the Spanish
  base column when a translation is missing.
- See `src/i18n/types.ts` for the typed translation shape.

## Deploying

This is a SPA, so any static host works. `public/_redirects` (Netlify /
Cloudflare Pages) and `vercel.json` ship rewrite rules so deep links work.
See `FINDINGS.md` for the production checklist.
