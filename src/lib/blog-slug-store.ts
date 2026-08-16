import { useSyncExternalStore } from "react";
import { Locale } from "@/i18n/types";

/**
 * Tiny external store holding the localized slugs of the article currently on
 * screen, so the header language switcher can jump to the right localized URL
 * instead of reusing the current slug.
 */
export type PostSlugs = Record<Locale, string> | null;

let current: PostSlugs = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

export const setCurrentPostSlugs = (slugs: PostSlugs) => {
  if (current === slugs) return;
  if (
    current &&
    slugs &&
    current.es === slugs.es &&
    current.en === slugs.en &&
    current.ru === slugs.ru
  ) {
    return;
  }
  current = slugs;
  emit();
};

export const getCurrentPostSlugs = (): PostSlugs => current;

export const useCurrentPostSlugs = (): PostSlugs =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getCurrentPostSlugs,
    getCurrentPostSlugs,
  );
