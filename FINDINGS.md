# FINDINGS — audit & cleanup pass

Branch: `audit-and-cleanup` · Date: 2026-05-30

This document tracks items the audit surfaced that need decisions or assets
from you. Code-level fixes are already on the branch as separate commits.

---

## 🔴 CRITICAL — security items

Both deferred CRITICAL items are now **RESOLVED** on `audit-and-cleanup`.

> ⚠️ **One thing to confirm before applying RLS to the live DB — project routing.**
> The committed `.env` (and the anon JWT inside it) point to Supabase project
> **`ukjljyrejfkyurebksqz`**, which is where the real content lives. The project
> referenced as "live" elsewhere, **`cmragiefvcbvsyzgtwhe`** ("eliasmas"), is
> currently **empty** (no tables / migrations / buckets). Apply the RLS migration
> and create the owner user on **whichever project Netlify's `VITE_SUPABASE_URL`
> / `VITE_SUPABASE_PUBLISHABLE_KEY` actually point to** — verify that in the
> Netlify dashboard. The code and migration are project-agnostic; only the
> "where to apply / where to create the user" target depends on this.

### 1. Wide-open RLS on every public table — ✅ RESOLVED

**Was:** `services`, `faqs`, `testimonials`, `promotions`, `site_content`,
`page_images`, `blog_posts`, `content_history`, `conversion_events` all shipped
`FOR INSERT/UPDATE/DELETE … (true)` policies — anyone with the anon key (shipped
to every browser) could insert/update/delete every row in the CMS.

**Fix:** new migration
`supabase/migrations/20260608223603_rls_lockdown_auth_write.sql` rewrites the
policies (atomic, single transaction — public reads never break mid-apply):

| Table | anon (public) | authenticated owner |
| --- | --- | --- |
| `services`, `faqs`, `testimonials`, `promotions`, `site_content`, `page_images`, `blog_posts` | SELECT | SELECT + INSERT/UPDATE/DELETE |
| `content_history` | — (none) | SELECT only¹ |
| `conversion_events` | INSERT only² | SELECT |
| storage bucket `media` | SELECT (read) | SELECT + INSERT + DELETE |

¹ `content_history` rows are written by the existing `log_content_change()`
trigger, which is `SECURITY DEFINER` and bypasses RLS — so no INSERT policy is
needed and the edit log keeps recording.
² `conversion_events` must stay anon-INSERT because the **public** site logs
WhatsApp/contact conversions write-only (`src/lib/analytics.ts`). SELECT is
authenticated-only so visitors can't read everyone's conversion data.

**To apply** (on the live project — see the routing note above):
- Supabase CLI: `supabase db push` (preferred — keeps migration history), **or**
- Supabase dashboard → SQL Editor → paste the migration file's contents → Run.

### 2. `/dashboard` route is unauthenticated — ✅ RESOLVED

**Was:** `src/App.tsx` mounted `/dashboard` with no guard; anyone with the URL
got the CMS UI (and, with open RLS, real write access).

**Fix:** Supabase email/password auth, single owner account:
- `src/contexts/AuthContext.tsx` — session state via `getSession()` +
  `onAuthStateChange`.
- `src/components/RequireAuth.tsx` — wraps `/dashboard`; shows a spinner while
  the session resolves, redirects unauthenticated users to `/login` (preserving
  the attempted path).
- `src/pages/Login.tsx` — email/password login screen (i18n es/en/ru),
  redirects back to the dashboard on success.
- Sign-out button added to the dashboard sidebar.
- No credentials are hardcoded. Public (non-dashboard) routes are untouched.
  Note: `/en/dashboard` and `/ru/dashboard` are **not** routes (they 404 →
  NotFound); the dashboard switches locale internally, so only `/dashboard`
  needs the gate.

**Create the owner user** (do this on the live Supabase project — see routing
note above; the site has no public sign-up, so create it manually):
1. Supabase dashboard → **Authentication → Users → Add user → Create new user**.
2. Enter the owner's email + a strong password.
3. Tick **"Auto Confirm User"** (otherwise the account stays unconfirmed and
   can't sign in, since no confirmation email flow is wired up).
4. Visit `/dashboard` → you'll be redirected to `/login` → sign in with those
   credentials.

To rotate the password later: same Users screen → the user → **Reset password**
(or send a recovery email). To add a second editor, just add another user —
every authenticated user has full write access by design.

### 3. `.env` is committed to the repo

`.env` is in git history with the Supabase URL + anon key. The anon key
itself is public by design (it's the publishable key, RLS is what makes
it safe — see #1), so this isn't a leak per se, but:

- `.gitignore` is now updated to ignore future `.env` changes.
- `.env.example` was added.
- You may want to rotate the project just to wipe history if anything
  ever ends up in `.env` that *isn't* meant to be public.

---

## 🟡 MEDIUM — non-security items

### 4. AI gateway still routes through `ai.gateway.lovable.dev`

Per your "option (a)" decision, the URL is kept so the AI features keep
working. Both edge functions now use renamed constants (`AI_GATEWAY_URL`
/ `AI_GATEWAY_KEY`) and accept `AI_GATEWAY_KEY` *or* the legacy
`LOVABLE_API_KEY` from Supabase secrets. When you're ready to migrate
to a direct provider (Anthropic / OpenAI / Gemini), the surface is small:

- `supabase/functions/ai-content-helper/index.ts`
- `supabase/functions/blog-generator/index.ts`

Both expect an OpenAI-shaped chat-completions endpoint. Swap the URL,
keep the same tool-calling schema, and bump the model id.

### 5. `use-integrations-injector` won't react to GA4/GTM ID edits mid-session

The injector now respects consent, but if you change the GA4 ID in the
dashboard, the public site picks it up on next full page reload (the
hook re-runs only when `analyticsGranted` flips). This is fine for the
normal flow — admins reload after editing — but worth knowing.

Fix is a small refactor: turn the inline fetch into a `useQuery` keyed
off `["site_content", "integrations"]` so the injector re-runs when the
dashboard invalidates that key.

### 6. Unhandled rejection in tests: Supabase auth client storage

`npm test` shows:

```
TypeError: storage.getItem is not a function
  at getItemAsync …/auth-js/src/lib/helpers.ts:133:31
```

Tests still pass (14/14). The auth client kicks off an autoRefresh timer
on construction (in `src/integrations/supabase/client.ts`) that fires
after the jsdom env is torn down. Two clean fixes:

- Move `resolveField` out of `use-db-content.ts` so the locale-fallback
  tests don't pull in `supabase/client.ts` at all.
- Or set `persistSession: false` / mock the client in `src/test/setup.ts`.

Low priority — purely test-noise.

### 7. Bundle size: Dashboard chunk is 614 kB

After Phase 7's lazy-loading the main public bundle is 633 kB (gzip
189 kB) — roughly half what it was. The Dashboard chunk is now 614 kB
on its own, dominated by TipTap. Only the admin loads it, so it's a
non-issue for visitors. If you want to shrink it further, lazy-load
each editor inside `Dashboard.tsx` (Suspense + dynamic imports per
section).

### 8. Images in `src/assets/` are not optimized

Hero/carousel JPGs are 300 kB – 2.4 MB each. They're imported as ES
modules so Vite fingerprints + caches them, but they're not resized
or converted to WebP/AVIF. For the carousels, the `Media` dashboard
already does client-side resize + server-side WebP at upload time —
worth doing the same one-off pass on the static `src/assets/` images
(e.g. `squoosh-cli` or `vite-imagetools`).

---

## 🟢 LOW — leftover lint warnings

`npm run lint` reports 65 problems (50 errors / 15 warnings), down from
71 / 57 at the start of this pass. The remaining errors are mostly
pragmatic `any`s at the Supabase boundary (`DashboardBlog.tsx`,
`DashboardSiteContent.tsx`, `DashboardHistory.tsx`) where the row shape
is dynamic, and a couple of `Fast refresh` warnings on shadcn/ui
components that export both a component and constants (e.g.
`sidebar.tsx`, `sonner.tsx`). Neither is a correctness issue.

---

## ✅ Assets I need you to supply

1. **Open-graph / social share image** — `public/og-image.jpg`,
   1200×630, ~150 kB JPG. `index.html` already references
   `https://eliasmas.es/og-image.jpg`. Until you upload it, link
   previews on WhatsApp / Twitter / Facebook will fall back to no image.

2. **SVG favicon** — `public/favicon.svg`. The `.ico` works as a
   fallback but modern browsers prefer the SVG (sharper at every size).

3. **Apple touch icon** — `public/apple-touch-icon.png`, 180×180 PNG
   on a non-transparent background.

4. **PWA icons** — `public/icon-192.png` (192×192) and
   `public/icon-512.png` (512×512). Referenced by `site.webmanifest`.

5. **Privacy / cookie policy text** — `src/pages/Privacidad.tsx` is a
   placeholder. Once you have the legal copy (or a clinic template),
   drop it into the `placeholder` field in
   `src/i18n/{es,en,ru}.ts → cookies.privacy.placeholder`, or expand
   the page itself with full sections.

6. **GTM container ID (if you want GTM)** — leave blank in the
   dashboard if you don't. The static `GTM-PLACEHOLDER` iframe was
   removed; the dashboard injector creates one only when a real ID is
   configured. Note that GTM also goes through the analytics consent
   gate now.

---

## Host-side / deploy

Host is **Netlify**. The deploy config now lives in two places:

- `public/_redirects` — the SPA fallback (`/*  /index.html  200`). Vite
  ships it into `dist/` at build time.
- `netlify.toml` — build settings + cache headers:
  - `/index.html` → `Cache-Control: no-cache` (so favicon `?v=` busts
    work and new bundle hashes deploy cleanly).
  - `/assets/*` → `Cache-Control: public, max-age=31536000, immutable`
    (Vite already fingerprints these).

Still on you to verify:

1. **Custom domain HTTPS / HSTS** — confirm `eliasmas.es` has HSTS
   enabled in the Netlify dashboard (Domain → HTTPS → "Force HTTPS"
   is on by default; HSTS is a separate toggle).

2. **Netlify build settings vs. dashboard** — `netlify.toml` declares
   `command = "npm run build"` and `publish = "dist"`. If the Netlify
   dashboard already had different settings, the toml wins on next
   deploy. Worth a glance.

---

## Summary of what changed on this branch

| Phase | Commits | Headline |
| --- | --- | --- |
| 1 — discover | — | findings only, no edits |
| 2 — React Query | 2 | content hooks migrate; mutations invalidate public reads |
| 3 — favicon | 1 | favicon links + manifest; drop placeholder.svg |
| 4 — de-Lovable | 1 | rename, drop tagger + broken playwright; rewrite README |
| 5 — i18n | 1 | sync `<html lang>` on first paint; lock array parity in tests |
| 6 — dashboard | 1 | history-restore invalidates public queries |
| 7 — stability | 1 | lazy-load heavy routes; clean trivial lint |
| 8 — consent | 1 | full GDPR banner + Consent Mode v2 + privacy page |
| 9 — security | 2 | Supabase auth gate on /dashboard + RLS lockdown (anon read-only) |

Baseline at start of audit: `npm run lint` 71 problems, build 1,264 kB
main bundle, 8 tests passing with 1 unhandled rejection.

After this branch: `npm run lint` 65 problems (50 errors), build
633 kB main bundle (lazy chunks for Dashboard / Blog / BlogPost /
AnalyticsCheck), 14 tests passing (still the same 1 unhandled rejection
documented in item #6 above).
