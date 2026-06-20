# WhatsApp Booking Flow

This document describes how visitors convert into booking conversations via WhatsApp, the message templates used in the prefilled deep-links, and how leads are tracked end-to-end.

Companion diagram: **`WhatsApp_Booking_Flow.mmd`** (Mermaid sequence diagram).

---

## 1. Overview

The site has **no in-app booking form**. Every "book" / "enquire" CTA opens a WhatsApp chat with **Elias (`+34 698 968 007`)** at `wa.me/34698968007?text=<prefilled-message>`. Each click is:

1. Forwarded to **GA4** + **GTM `dataLayer`** as `whatsapp_click` + `generate_lead`.
2. Mirrored into **`public.conversion_events`** in Lovable Cloud so the admin dashboard's Attribution panel can show counts without depending on the GA4 Data API.
3. Opened in a **new tab** so the visitor doesn't lose the site context.

The actual booking confirmation happens out-of-band in WhatsApp, between the visitor and Elias.

---

## 2. Step-by-step flow

| # | Step | What happens | Where |
|---|---|---|---|
| 1 | Visitor lands on a page | Public marketing page renders (ES/EN/RU) | `src/pages/*` |
| 2 | CTA is rendered | `<a href={WHATSAPP_URL or whatsappUrl(msg)}>` with `target="_blank" rel="noopener noreferrer"` | `src/config/contact.ts` |
| 3 | Visitor clicks the CTA | `onClick` fires `trackWhatsAppClick(location, extra)` **before** the browser follows the link (so we don't lose the event on tab switch) | `src/lib/analytics.ts` |
| 4 | GA4 event sent | `gtag('event', 'whatsapp_click', { location, method:'WhatsApp', ...extra })` | `pushToGa()` |
| 5 | Lead event sent | `gtag('event', 'generate_lead', { location, method:'WhatsApp', ...extra })` (standard GA4 conversion) | `pushToGa()` |
| 6 | DB row inserted | Fire-and-forget `INSERT` into `public.conversion_events` (skipped on `/dashboard`) | `logToDb()` |
| 7 | New tab opens | Browser navigates to `wa.me/34698968007?text=<urlencoded message>` | Native `<a target="_blank">` |
| 8 | WhatsApp draft shown | WhatsApp app or WhatsApp Web opens with prefilled message; visitor edits/sends | WhatsApp |
| 9 | Conversation continues | Elias replies, qualifies, books a slot manually | WhatsApp (out-of-app) |
| 10 | Lead surfaced in dashboard | `/dashboard` → Attribution panel reads `conversion_events`, groups by `location` and `event_name` | `src/components/dashboard/DashboardAttribution.tsx` |

---

## 3. Message templates

All templates live as URL-encoded strings inside `src/config/contact.ts` and `src/components/GiftCardHighlight.tsx`. They are intentionally short and Spanish-default — visitors editing the draft is expected behavior.

| Template ID | Used by | Body (decoded) |
|---|---|---|
| `default_booking` | Header buttons, floating button, all hero/service-card CTAs | `Hola, me gustaría reservar una cita` |
| `gift_card_enquiry` | `GiftCardHighlight` component | `Hola, me gustaría información sobre tarjetas regalo` |
| `service_specific` _(dynamic)_ | Service cards on home & services pages | _(currently uses `default_booking`; the service name is sent only as analytics metadata, not into the WhatsApp text)_ |

**Helpers:**

```ts
// src/config/contact.ts
export const WHATSAPP_PHONE = "34698968007";
export const WHATSAPP_DEFAULT_MESSAGE = "Hola%2C%20me%20gustaría%20reservar%20una%20cita";
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_PHONE}?text=${WHATSAPP_DEFAULT_MESSAGE}`;

/** Build a WhatsApp URL with any custom prefilled message. */
export const whatsappUrl = (message: string) =>
  `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
```

To add a new template, just call `whatsappUrl("Your message")` inline — do not hand-build `wa.me` URLs, so the phone number stays in one place.

---

## 4. `trackWhatsAppClick` API

```ts
trackWhatsAppClick(location: string, extra?: Record<string, string|number|boolean|undefined>): void
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `location` | `string` | ✅ | Stable identifier of the CTA placement. Used to group leads in the dashboard. Convention: `<page>_<placement>`. |
| `extra.service_name` | `string` | optional | Sent when the CTA is on a service card; lets the dashboard slice leads by service. |
| `extra.*` | scalar | optional | Any additional flat key/values to attach. Avoid PII. |

### Canonical `location` values

| Location | Component | Notes |
|---|---|---|
| `home_hero` | `OrganicHome.tsx` | Main hero CTA |
| `home_service_card` | `OrganicHome.tsx` | Per-service tile on home — sends `service_name` |
| `home_gift_card` | `OrganicHome.tsx` | Gift card highlight on home |
| `home_final_cta` | `OrganicHome.tsx` | "Ready to feel better?" CTA before footer |
| `services_card` | `OrganicServices.tsx` | Card on services page — sends `service_name` |
| `services_final_cta` | `OrganicServices.tsx` | Bottom CTA on services page |
| `service_card` | `ServiceCard.tsx` | Generic re-usable card — sends `service_name` |
| `about_final_cta` | `OrganicAbout.tsx` | Bottom CTA on about page |
| `contact_page_send_message` | `OrganicContact.tsx` | "Send message" on contact card — also fires `contact_submit` |
| `contact_page_final_cta` | `OrganicContact.tsx` | Bottom CTA on contact page |
| `header_desktop` | `Header.tsx` | Top-bar button (≥md) |
| `header_mobile` | `Header.tsx` | Mobile menu button |
| `floating_button` | `WhatsAppButton.tsx` | Persistent floating WhatsApp bubble |
| `gift_card_highlight` | `GiftCardHighlight.tsx` | Gift card block (used on multiple pages) |

When adding a new CTA, **pick a new `location` value** rather than reusing one of these, otherwise the dashboard will conflate placements.

---

## 5. Events emitted

### 5.1 GA4 / GTM `dataLayer`

| Event | Trigger | Parameters |
|---|---|---|
| `whatsapp_click` | Every WhatsApp CTA click | `location`, `method: "WhatsApp"`, plus any `extra` (e.g. `service_name`) |
| `generate_lead` | Same click (GA4 standard conversion) | `location`, `method: "WhatsApp"`, plus `extra` |
| `contact_submit` | Contact page "Send message" + form submits | `location`, plus `extra` |
| `generate_lead` | Same contact submit | `location`, `method: "form"` |

GA4 should be configured to mark `generate_lead` as a **conversion** (Admin → Events). GTM can fan this out to Ads, Meta Pixel, etc. — no extra code needed, just add tags listening on the `dataLayer` events.

### 5.2 `public.conversion_events` table

Schema (`supabase/migrations/20260507141233_*.sql`):

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `event_name` | `text` | `whatsapp_click` or `contact_submit` |
| `location` | `text` | See canonical list above |
| `metadata` | `jsonb` | The `extra` object (e.g. `{ service_name: "Deep tissue" }`) |
| `page_path` | `text` | `window.location.pathname + search` at click time |
| `locale` | `text` | `<html lang>` at click time (`es`, `en`, `ru`) |
| `created_at` | `timestamptz` | `now()` |

Indexes on `created_at DESC`, `event_name`, `location` for fast dashboard queries.

**RLS:**
- `INSERT` — public (anon visitors must be able to log their own click).
- `SELECT` — **admins only**, gated through `has_role(auth.uid(), 'admin')` (tightened in migration `20260604224744_*.sql`; the original public-read policy was dropped).

Inserts are **fire-and-forget** (`void supabase.from(...).insert(...)`), and they are **skipped on `/dashboard`** to avoid noise from the admin reviewing the site.

---

## 6. Where leads are surfaced

- **`/dashboard` → Attribution** (`DashboardAttribution.tsx`) — counts by `location` and `event_name`, filterable by date range and locale.
- **`/dashboard` → Overview** — top-line "leads this week / month" pulled from `conversion_events`.
- **GA4 Realtime / Reports** — same events, with full GA4 reporting (geo, device, source/medium, etc.).
- **GTM-connected destinations** — anything piped through GTM tags (Meta Pixel, Google Ads conversions, etc.).

---

## 7. Adding a new CTA — checklist

1. Import the helper: `import { WHATSAPP_URL, whatsappUrl } from "@/config/contact";`
2. Use `WHATSAPP_URL` for the default booking message, or `whatsappUrl("Hola, ...")` for a custom one.
3. Render `<a href={...} target="_blank" rel="noopener noreferrer">`.
4. Add `onClick={() => trackWhatsAppClick("<new_location_id>", { /* optional extras */ })}`.
5. Add the new `location` value to §4 of this doc so the next person knows what it means.
6. (Optional) In GA4, ensure `generate_lead` is still flagged as a conversion.

---

## 8. Privacy notes

- The prefilled message is visible in the visitor's browser address bar before the WhatsApp app takes over — keep it generic, never include PII.
- `conversion_events.metadata` should stay free of PII. The `service_name` field is the only thing we currently store.
- WhatsApp messages themselves never touch our infrastructure — they go directly between the visitor and Elias.
- `conversion_events` is admin-read-only via RLS; the publishable anon key cannot list it.
