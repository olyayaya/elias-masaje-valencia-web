# FINDINGS — audit & cleanup pass

Branch: `audit-and-cleanup` · Date: 2026-05-30

This document tracks items the audit surfaced that need decisions or assets
from you. Code-level fixes are already on the branch as separate commits.

---

## 🔴 CRITICAL — security items

Auth (item #2) is resolved in code. RLS (item #1) ⚠️ **see reversal note below** —
the lockdown was applied to `cmragiefvcbvsyzgtwhe`, but we have since reverted to
the Lovable DB, where RLS is **still wide-open**.

> 🔄 **REVERSED (2026-06-09, later same day).** Decision changed: keep using the
> existing **Lovable** project **`ukjljyrejfkyurebksqz`** (it already holds the
> real content) instead of migrating to `cmragiefvcbvsyzgtwhe`. `.env` is
> repointed back to `ukjljyrejfkyurebksqz`.
>
> **⚠️ Security consequence:** the RLS lockdown + hardening were applied to
> `cmragiefvcbvsyzgtwhe`, **not** to the Lovable DB. So on `ukjljyrejfkyurebksqz`
> the original CRITICAL #1 is **still open** — anyone with the anon key (shipped
> in every browser) can INSERT/UPDATE/DELETE all content. The client-side auth
> gate hides the dashboard UI, but does **not** stop direct API writes with the
> anon key. To actually close it, the lockdown SQL must be run in **Lovable's SQL
> editor** (we can't reach that project via our tooling) — and the owner user +
> magic-link redirect URLs must be set up on the Lovable project's Auth first, or
> locking writes to `authenticated` will break the dashboard's ability to save.
> The migration files
> (`20260608223603_rls_lockdown_auth_write.sql`, `…223604_rls_hardening.sql`)
> still apply as-is. Data import + image migration are now **moot** (data already
> lives in the Lovable DB). The `cmragiefvcbvsyzgtwhe` work is preserved and can
> be re-adopted by repointing `.env` again.

> ✅ **Project routing — RESOLVED (Path A, 2026-06-09) — superseded by the
> reversal above.**
> The live project is **`cmragiefvcbvsyzgtwhe`** ("eliasmas") — confirmed:
> Netlify's `VITE_SUPABASE_URL` points there. It started **empty**, so the whole
> repo migration set was (re)applied to it and RLS was locked down **directly**
> (it's reachable via our Supabase tooling). The old Lovable-Cloud project
> `ukjljyrejfkyurebksqz` (in the previously-committed `.env`, not in our account)
> is being retired; its real content still needs to be exported and imported —
> see **"Data migration from Lovable"** below. `.env` is now repointed to
> `cmragiefvcbvsyzgtwhe`.
>
> **State of `cmragiefvcbvsyzgtwhe` right now:** full schema (9 tables + `media`
> bucket), RLS locked down, but only the migrations' **seed rows** (3 services,
> 4 FAQs, 3 testimonials, 1 blog post, 39 site_content keys). Elias's real
> content lands here once the Lovable export is imported.

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
| storage bucket `media` | object URLs only³ | SELECT (list) + INSERT + DELETE |

¹ `content_history` rows are written by the existing `log_content_change()`
trigger, which is `SECURITY DEFINER` and bypasses RLS — so no INSERT policy is
needed and the edit log keeps recording.
² `conversion_events` must stay anon-INSERT because the **public** site logs
WhatsApp/contact conversions write-only (`src/lib/analytics.ts`). SELECT is
authenticated-only so visitors can't read everyone's conversion data.
³ A follow-up migration
`supabase/migrations/20260608223604_rls_hardening.sql` tightened the `media`
bucket: client-side **listing** is now authenticated-only, and the
`log_content_change()` trigger function is no longer callable as an RPC. Public
image *display* is unaffected — the bucket is public, so images are served via
the public CDN URL (`getPublicUrl`), which bypasses RLS.

**Applied to `cmragiefvcbvsyzgtwhe`** directly via migrations (2026-06-09) — all
18 repo migrations + the lockdown + the hardening migration. Verified as the
`anon` role: content reads succeed, writes are rejected with an RLS error, and
`conversion_events` inserts still work. A fresh project can be reproduced with
`supabase db push`.

**Remaining advisor notes (all benign / by-design):**
- `rls_policy_always_true` on the authenticated write policies — intentional:
  single-owner CMS, every authenticated user *is* the owner.
- `public_bucket_allows_listing` on `media` — listing is now authenticated-only;
  the warning persists only because the bucket is public *and* has a list policy
  (the dashboard's media browser needs `.list()`). Closing it fully would mean a
  private bucket + signed URLs, which is out of scope for this pass.
- `rls_auto_enable()` SECURITY DEFINER — a Supabase platform event-trigger that
  auto-enables RLS on new tables; returns `event_trigger`, so it can't be called
  via RPC. Left as-is.

### 2. `/dashboard` route is unauthenticated — ✅ RESOLVED

**Was:** `src/App.tsx` mounted `/dashboard` with no guard; anyone with the URL
got the CMS UI (and, with open RLS, real write access).

**Fix:** Supabase **email + password** auth, single owner account, persistent
session. (We briefly switched to magic-link per the client meeting, then reverted
to password on 2026-06-12 for a simpler launch — magic-link needs redirect-URL
config on the project's Auth, which isn't reliably reachable on the Lovable DB.)
- `src/contexts/AuthContext.tsx` — session state via `getSession()` +
  `onAuthStateChange`; `signIn(email, password)` calls `signInWithPassword`.
- `src/integrations/supabase/client.ts` — `persistSession: true`,
  `autoRefreshToken: true`, `storage: localStorage` → the session survives
  reloads/restarts and auto-refreshes; there is **no idle timeout**. The token
  only ends on explicit **Sign out**.
- `src/components/RequireAuth.tsx` — wraps `/dashboard`; shows a spinner while
  the session resolves, redirects unauthenticated users to `/login` (preserving
  the attempted path).
- `src/pages/Login.tsx` — email + password screen (i18n es/en/ru); redirects
  back to the attempted route on success, shows "Incorrect email or password"
  on failure.
- Sign-out button in the dashboard sidebar.
- No credentials are hardcoded. Public (non-dashboard) routes are untouched.
  Note: `/en/dashboard` and `/ru/dashboard` are **not** routes (they 404 →
  NotFound); the dashboard switches locale internally, so only `/dashboard`
  needs the gate.

**Create the owner (client's) user** — on the **live** project's Auth (currently
the Lovable DB **`ukjljyrejfkyurebksqz`**; or `cmragiefvcbvsyzgtwhe` if/when we
migrate back):
1. Open the project's Supabase Auth → **Authentication → Users → Add user →
   Create new user**.
2. Enter the **client's email + a password**, and tick **"Auto Confirm User"**
   (otherwise the account stays unconfirmed and can't sign in).
3. Visit `/dashboard` → redirected to `/login` → sign in with that email +
   password. The session then persists until **Sign out**.

To rotate the password later: same Users screen → the user → **Reset password**.
To add a second editor, create another user the same way — every authenticated
user has full write access by design. No URL/redirect config is needed for
password login.

### 3. `.env` is committed to the repo

`.env` is in git history with the Supabase URL + anon key. The anon key
itself is public by design (it's the publishable key, RLS is what makes
it safe — see #1), so this isn't a leak per se, but:

- `.env` is now repointed from `ukjljyrejfkyurebksqz` → **`cmragiefvcbvsyzgtwhe`**
  (project id, URL, and anon key). Confirm Netlify's
  `VITE_SUPABASE_PUBLISHABLE_KEY` env var equals `cmragiefvcbvsyzgtwhe`'s anon
  key (the one now in `.env`) — if Netlify still holds the old project's key,
  the live site will fail to reach the DB.
- `.env.example` was added.
- The old `ukjljyrejfkyurebksqz` anon key is now dead weight in git history;
  it's harmless (RLS-protected, different project) but you can ignore it.

### Data migration from Lovable (`ukjljyrejfkyurebksqz` → `cmragiefvcbvsyzgtwhe`)

`cmragiefvcbvsyzgtwhe` currently holds only seed data. Elias's real content
lives in the Lovable-Cloud project `ukjljyrejfkyurebksqz`, which is **not** in
our Supabase account — so it must be exported from the Lovable side. Step-by-step
export instructions and the import plan are in the hand-off message; once an
export file or connection string is available, content tables are imported in
FK-safe order (`services` → `promotions`, then the rest) and `media` bucket
files re-uploaded.

---

## 🟡 MEDIUM — non-security items

### 4. AI features — DISABLED per client (✅ done 2026-06-09)

**Client decision:** does **not** want the AI blog/content agent. Goal: nothing
calls the paid Lovable AI gateway. Code is **kept**, not deleted.

**Disabled via a single flag** `src/config/features.ts` → `AI_ENABLED = false`.
Every AI call site is gated two ways:
- **UI hidden** — all AI buttons are wrapped in `{AI_ENABLED && …}`: badge
  suggestions (`DashboardPromotions`), translate/SEO on services
  (`DashboardServices`) and site content (`DashboardSiteContent`), and the whole
  blog generator panel + per-language "generate/translate" banners + the
  toolbar "regenerate" button (`DashboardBlog`).
- **Handlers guarded** — each handler that calls
  `supabase.functions.invoke("ai-content-helper" | "blog-generator", …)`
  early-returns when `!AI_ENABLED`, so even a missed button can't reach the
  gateway.
- **Blog manual-edit fix** — the blog editor used to hide the editor for an
  empty EN/RU tab and tell the admin to "generate from Spanish". With AI off it
  now falls through to an editable field so EN/RU can be written **manually**.

**Belt-and-suspenders:** the gateway was already unreachable on
`cmragiefvcbvsyzgtwhe` anyway — the `ai-content-helper` / `blog-generator` edge
functions aren't deployed there and no `AI_GATEWAY_KEY` secret is set. So there
is **no paid usage** from the new project regardless.

To **re-enable** later: flip `AI_ENABLED` to `true`, deploy the two edge
functions, and set the `AI_GATEWAY_KEY` secret. (`test-integration` is **not**
AI — it's the GA4/GTM checker — and is untouched.) To move to a real provider
(Anthropic / OpenAI / Gemini): both functions expect an OpenAI-shaped
chat-completions endpoint — swap `AI_GATEWAY_URL`, keep the tool-calling schema,
bump the model id.

### Dashboard analytics — now REAL Google Analytics 4 (2026-06-12)

**Was:** the Overview top-stat cards ("1,240 monthly views", "Top 5", "66+ reviews")
and the entire SEO stats row + "Top Search Queries" table were **hardcoded fake**
numbers. (The section count cards and the Attribution tab were already real.)

**Now:** real GA4 via a **Netlify Function** (chosen because the live site runs on
Netlify and the Supabase edge-function route isn't reachable on the Lovable DB):
- `netlify/functions/ga4-report.mjs` — signs the service-account JWT with
  `node:crypto`, exchanges it for a token, calls the **GA4 Data API** `runReport`
  (page views, visitors, sessions, avg session + a by-day series). Zero deps.
- `src/hooks/use-ga4.ts` + `src/components/dashboard/Ga4Stats.tsx` — fetch
  `/.netlify/functions/ga4-report` and render real cards in **Overview** and
  **SEO**. Until GA4 is configured it shows a "Connect Google Analytics" notice —
  **never invented numbers**. `netlify.toml` declares the functions dir.
- SEO's fake "Top Search Queries" is replaced with an honest note: that data is
  **Google Search Console** (a different API), not GA — not yet connected.
  Likewise "Google position / reviews" would need Search Console / Business
  Profile APIs. Keyword suggestions / checklist / tips remain as static tools.

**Setup required to light it up** (until then, the dashboard shows the connect
notice — no fakes):
1. **Google Cloud** → a project → **enable the "Google Analytics Data API"** →
   **IAM & Admin → Service Accounts → Create** → on it, **Keys → Add key → JSON**
   (downloads the key file).
2. **GA4** → Admin → **Property Access Management** → add the service account's
   email as **Viewer**.
3. Get the **numeric property ID**: GA4 Admin → **Property Settings** → the
   number near the top (e.g. `456789123`). This is **not** the `G-XXXX`
   measurement id.
4. **Netlify** → Site configuration → Environment variables → add:
   - `GA4_PROPERTY_ID` = the numeric id
   - `GA4_SERVICE_ACCOUNT` = the **entire** JSON key file contents (paste as-is)
5. **Clear cache and deploy** → the real numbers appear.

### Price "from / desde / от" prefix — ✅ FIXED (2026-06-09)

**Was:** when the admin entered a price like "Desde 50€" / "From €50" / "от 50€",
the public site showed just "50€" — the prefix never rendered. `formatPrice()`
in `src/lib/format-price.ts` stripped any leading prefix but then **ignored the
`hidePrefix` option and never re-emitted it**, even though the dashboard toggle
("Hide the from/desde/от prefix"), the `services.hide_price_from` column, and the
`priceFrom` i18n labels (`desde`/`from`/`от`) all already existed and were wired
through `OrganicServices` / `OrganicHome` / the dashboard preview.

**Fix:** `formatPrice()` now re-emits the prefix in the **active locale** when the
admin typed one OR the price is a range ("50€ / 70€" → "from 50€ / 70€"), unless
the per-service toggle hides it. So ES shows "desde 50 €", EN "from 50 €", RU
"от 50 €". Only `src/lib/format-price.ts` changed — no schema or UI change needed.

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
| 9 — security | 4 | auth gate on /dashboard; RLS lockdown + hardening; schema rebuilt in live project `cmragiefvcbvsyzgtwhe`; `.env` repointed |
| 10 — go-live | (pending push) | magic-link auth + persistent session; price "from/desde/от" prefix fix; AI-off flagged; data import (awaiting export) |

Baseline at start of audit: `npm run lint` 71 problems, build 1,264 kB
main bundle, 8 tests passing with 1 unhandled rejection.

After this branch: `npm run lint` 65 problems (50 errors), build
633 kB main bundle (lazy chunks for Dashboard / Blog / BlogPost /
AnalyticsCheck), 14 tests passing (still the same 1 unhandled rejection
documented in item #6 above).
