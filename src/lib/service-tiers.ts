/**
 * Services store duration/price as parallel, slash-separated strings, e.g.
 *   duration: "1h / 1.5h / 2h"
 *   price:    "50€ / 70€ / 100€"
 *
 * The booking dialog needs one duration → one price, matched by index.
 * This helper is the single place that parses those strings.
 *
 * Rules:
 *  - split on "/" and trim
 *  - pair by index ONLY when both sides have the same number of parts
 *  - a single price with several durations pairs every duration with that price
 *  - any other mismatch → no tiers (caller keeps the raw strings; we never
 *    invent a duration/price combination that isn't in the data)
 */

export interface ServiceTier {
  duration: string;
  price: string;
}

const split = (value: string | undefined | null): string[] =>
  (value ?? "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);

export function parseServiceTiers(
  duration: string | undefined | null,
  price: string | undefined | null,
): ServiceTier[] {
  const durations = split(duration);
  const prices = split(price);

  if (durations.length === 0) return [];
  if (prices.length === durations.length) {
    return durations.map((d, i) => ({ duration: d, price: prices[i] }));
  }
  if (prices.length === 1) {
    return durations.map((d) => ({ duration: d, price: prices[0] }));
  }
  if (prices.length === 0) {
    return durations.map((d) => ({ duration: d, price: "" }));
  }
  return [];
}
