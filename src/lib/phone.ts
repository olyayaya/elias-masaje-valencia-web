/**
 * Phone normalization for wa.me links.
 *
 * Rules:
 *  - "+34 600 11 22 33" → "34600112233"
 *  - "0034600112233"    → "34600112233"
 *  - "600112233" (9-digit Spanish local) → "34600112233"
 *  - empty / clearly invalid → null (never fall back to the business number)
 */
export const normalizePhoneForWhatsApp = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  // Reject anything containing letters — not a phone number.
  if (/[a-zA-Zа-яА-Я]/.test(trimmed)) return null;

  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  let normalized = digits;
  if (!hasPlus && digits.startsWith("00")) {
    normalized = digits.slice(2);
  } else if (!hasPlus && digits.length === 9 && /^[6789]/.test(digits)) {
    // Spanish local mobile/landline
    normalized = `34${digits}`;
  }

  if (normalized.startsWith("0")) return null;
  if (normalized.length < 8 || normalized.length > 15) return null;
  return normalized;
};

export const isWhatsAppReachable = (raw: string | null | undefined): boolean =>
  normalizePhoneForWhatsApp(raw) !== null;

/** Builds a wa.me link to the given phone only. Returns null when unusable. */
export const leadWhatsAppUrl = (raw: string | null | undefined, message: string): string | null => {
  const phone = normalizePhoneForWhatsApp(raw);
  if (!phone) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};
