import { useEffect, useState } from "react";
import { getConsent, onConsentChange, ConsentState } from "@/lib/consent";

/**
 * Subscribes to the cookie-consent state. Re-renders consumers when the
 * banner publishes a new decision (or the value is cleared).
 */
export function useConsent(): ConsentState | null {
  const [state, setState] = useState<ConsentState | null>(() => getConsent());

  useEffect(() => onConsentChange(setState), []);

  return state;
}
