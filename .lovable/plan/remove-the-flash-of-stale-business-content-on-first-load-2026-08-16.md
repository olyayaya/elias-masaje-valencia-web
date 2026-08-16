# Remove the flash of stale business content on first load

## Confirmed root cause (verified in current code)

- `src/hooks/use-db-content.ts` — every hook returns `data ?? null`. Consumers cannot tell "loading" from "loaded empty", and no error state is exposed.
- `src/components/organic/OrganicHome.tsx:81-92` — services, FAQs and testimonials fall back to `t.services.items`, `t.faq.items`, `t.testimonials.items` while loading. The Spanish file still contains "Masaje descontracturante", "Masaje relajante", "Masaje deportivo" with prices 50/45/40 €.
- `src/components/organic/OrganicHome.tsx:302` — hardcoded `sc.google_rating || "5.0"` and `sc.google_review_count || "66"`.
- `src/components/organic/OrganicServices.tsx:117` — same `?? t.services.items` fallback on the services page.
- `src/components/organic/OrganicContact.tsx:74-82` and `src/components/Footer.tsx:57-59` — `sc.contact_weekdays || t.contact.weekdays` etc. The i18n files hold `9:00 – 20:00` weekday hours, so old hours flash before `site_content` resolves. `useSiteContent` already returns `loaded` (isFetched) but neither component reads it.
- `src/pages/Index.tsx:22` — FAQ JSON-LD falls back to `t.faq.items`, so stale FAQ content can be emitted into structured data on a slow load.
- `usePageImages` returns `data ?? []`, so consumers switch from built-in defaults to custom images mid-load (image swap flash, lower priority but same class of bug).

## Architecture

Introduce one explicit async-state shape in `use-db-content.ts` and reuse it everywhere:

```text
type AsyncState<T> =
  | { status: "loading" }
  | { status: "ready";  data: T }   // may be an empty array
  | { status: "error";  error: Error; retry: () => void }
```

Rules applied consistently:

- Loading → render a fixed-size skeleton in the exact slot the real content will occupy. No static business text.
- Ready + empty → render nothing for that block (section header stays), never static fallbacks.
- Error → compact localized neutral message ("No pudimos cargar esta información") with a Retry button that refetches, plus a WhatsApp link where booking is the user's goal (services blocks).
- Static UI (nav, hero image, headings, section labels, CTAs whose copy is UI text) renders immediately and is never gated.
- Skeletons use the existing `src/components/ui/skeleton.tsx`; `animate-pulse` is disabled under `prefers-reduced-motion` via a global CSS rule so no shimmer/motion is forced.

`useSiteContent` gains the same status discriminant while keeping `content` and `loaded` for existing callers, so dashboard consumers do not need to change.

## File-by-file change list

**Hooks / infrastructure**
- `src/hooks/use-db-content.ts` — add `AsyncState<T>`; convert `useDbServices`, `useDbFaqs`, `useDbTestimonials`, `useDbPromotions` to return it (expose `isLoading`, `error`, `refetch`). Keep `resolveField` unchanged.
- `src/hooks/use-site-content.ts` — return `{ content, loaded, status, error, retry }`; keep current fields for backward compatibility.
- `src/hooks/use-page-images.ts` — return `{ images, loaded }` so callers only swap to custom images once resolved (defaults stay for the empty/ready case).
- `src/components/ContentError.tsx` *(new)* — small localized "couldn't load / Retry / WhatsApp" block.
- `src/components/skeletons/ServiceSkeletons.tsx` *(new)* — `ServiceCardSkeleton` (home, 3 cards) and `ServiceRowSkeleton` (services page), fixed heights matching current rendered sizes.
- `src/index.css` — `@media (prefers-reduced-motion: reduce) { .animate-pulse { animation: none } }`.

**Pages / components**
- `src/components/organic/OrganicHome.tsx` — drop all three i18n fallbacks and the `"66"` / `"5.0"` literals; render 3 service skeletons, testimonial + rating-line skeleton (fixed height), FAQ skeleton; error states via `ContentError`.
- `src/components/organic/OrganicServices.tsx` — drop `?? t.services.items`; render row skeletons (count 4) while loading, `ContentError` on failure.
- `src/components/organic/OrganicContact.tsx` — gate address + the three hour lines on site-content status; fixed-height skeleton block; remove `t.contact.*` value fallbacks.
- `src/components/Footer.tsx` — same treatment for address and hour lines.
- `src/pages/Index.tsx` — emit FAQ JSON-LD only when DB FAQs are ready; no i18n fallback (structured data content itself unchanged when data is present).
- `src/i18n/es.ts`, `src/i18n/en.ts`, `src/i18n/ru.ts` — remove business-fact data: `services.items`, `testimonials.items`, `faq.items`, `contact.weekdays/saturday/sunday/addressValue`. Add loading/error UI strings (`common.loadError`, `common.retry`). Labels, headings and CTA copy stay.
- `src/i18n/types.ts` — update the shape accordingly.
- `src/test/i18n-parity.test.ts` — remove the three now-obsolete item-length assertions, add parity for the new strings.

Not changed: design tokens, layout, routes, analytics, DB values, `local-business.ts` schema hours, dashboard components.

## Test plan

New `src/test/content-loading.test.tsx` (Vitest + Testing Library, mocked `@/integrations/supabase/client` with a controllable deferred promise):

1. While pending: assert `Masaje descontracturante`, `Masaje deportivo`, `66`, `9:00 – 20:00` are absent from the DOM on `/`, `/servicios`, `/contacto`, `/en`, `/ru`.
2. While pending: assert skeleton placeholders are present (`data-testid="service-skeleton"` etc.).
3. After resolve: assert DB values render ("Masaje Antiestrés", "85+", "11:00 – 21:00" per mock fixtures).
4. After rejection: assert the neutral localized error + Retry appear, and no stale strings; clicking Retry refires the query.
5. Locale coverage: run the stale-string assertions for ES/EN/RU translations.
6. Run the full suite (`bunx vitest run`) and a production build.

## Decisions needing your confirmation

1. **Hours/address must exist in the database.** Once i18n fallbacks are removed, `contact_weekdays`, `contact_saturday`, `contact_sunday`, `contact_address` must be populated in `site_content` for all three locales, otherwise those lines render empty. I will verify the rows before implementing and report any gaps — but per your instruction I will not change DB content without approval.
2. **Rating line**: with `"5.0"`/`"66"` gone, if `google_rating`/`google_review_count` are missing the whole line is hidden rather than partially rendered. Confirm that's acceptable.
3. **Empty results**: if the services table ever returns zero rows, the section renders its heading with no items (no static fallback). Confirm preferred over hiding the section entirely.
