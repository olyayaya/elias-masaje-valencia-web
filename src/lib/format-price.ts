import type { Translations } from "@/i18n/types";

/**
 * Renders a price string with a localized "from" prefix when appropriate.
 *
 * The price field stored in the DB / translations is free-form (e.g. "50 €",
 * "от 50 €", "from €50", "desde 50 €", "50€ / 70€"). This helper:
 *  1. Strips any leading "from"-style prefix in any of the supported languages,
 *     so the prefix isn't duplicated or shown in the wrong language.
 *  2. Detects whether a "from" prefix should be applied — either because the
 *     admin typed one OR because the price contains a range (e.g. "50€ / 70€"),
 *     in which case "from <lowest>" is the natural reading.
 *  3. Re-emits the price using the active locale's `priceFrom` label, unless
 *     the caller passed `hidePrefix` (the per-service "Hide the from/desde/от
 *     prefix" toggle).
 *
 * Examples (locale = en):
 *   "от 50 €"        → "from 50 €"
 *   "desde 50 €"     → "from 50 €"
 *   "50€ / 70€"      → "from 50€ / 70€"   // range detected
 *   "50 €"           → "50 €"             // no prefix needed
 *   "desde 50 €" + hidePrefix → "50 €"    // toggle wins
 */

const PREFIX_PATTERNS = [
  /^\s*desde\s+/i,
  /^\s*from\s+/i,
  /^\s*от\s+/i,
];

const RANGE_PATTERN = /[/–—-]/; // multi-tier price like "50€ / 70€" or "50€-70€"

export function formatPrice(
  price: string | undefined | null,
  t: Translations,
  options?: { hidePrefix?: boolean },
): string {
  if (!price) return "";
  let body = price.trim();

  // Strip any leading "from"-style prefix the admin may have typed, in any
  // language — we re-emit it in the active locale below so it's never shown
  // in the wrong language or duplicated.
  let hadPrefix = false;
  for (const re of PREFIX_PATTERNS) {
    if (re.test(body)) {
      body = body.replace(re, "").trim();
      hadPrefix = true;
      break;
    }
  }

  if (!body) return "";

  // Show the prefix when the admin typed one OR the price is a range
  // ("50€ / 70€" reads naturally as "from 50€ / 70€"), unless the per-service
  // toggle explicitly hides it.
  const shouldShowPrefix =
    !options?.hidePrefix && (hadPrefix || RANGE_PATTERN.test(body));

  return shouldShowPrefix ? `${t.services.priceFrom} ${body}` : body;
}
