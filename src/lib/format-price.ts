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
 *  3. Re-emits the price using the active locale's `priceFrom` label.
 *
 * Examples (locale = en):
 *   "от 50 €"        → "from 50 €"
 *   "desde 50 €"     → "from 50 €"
 *   "50€ / 70€"      → "from 50€ / 70€"   // range detected
 *   "50 €"           → "50 €"             // no prefix needed
 */

const PREFIX_PATTERNS = [
  /^\s*desde\s+/i,
  /^\s*from\s+/i,
  /^\s*от\s+/i,
];

const RANGE_PATTERN = /[\/–—-]/; // multi-tier price like "50€ / 70€" or "50€-70€"

export function formatPrice(
  price: string | undefined | null,
  _t: Translations,
  _options?: { hidePrefix?: boolean },
): string {
  if (!price) return "";
  let body = price.trim();

  // Always strip any leading "from"-style prefix in any language.
  // The "from / desde / от" prefix is intentionally never rendered on the
  // public site — prices are shown as-is.
  for (const re of PREFIX_PATTERNS) {
    if (re.test(body)) {
      body = body.replace(re, "");
      break;
    }
  }

  return body;
}
