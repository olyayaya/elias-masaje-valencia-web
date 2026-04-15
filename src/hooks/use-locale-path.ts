import { useCallback } from "react";
import { useI18n } from "@/i18n/context";
import { PageId, ROUTE_MAP } from "@/config/routes";

/** Returns a function that resolves a PageId to the current locale's path. */
export function useLocalePath() {
  const { locale } = useI18n();
  return useCallback(
    (pageId: PageId, params?: Record<string, string>) => {
      let path = ROUTE_MAP[pageId][locale];
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          path = path.replace(`:${key}`, value);
        });
      }
      return path;
    },
    [locale]
  );
}
