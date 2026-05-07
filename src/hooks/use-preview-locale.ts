import { useEffect, useState } from "react";
import type { Lang } from "@/components/dashboard/LanguageTabs";

/**
 * Persists the editor's preview locale per browser user + per project.
 * Scoped to VITE_SUPABASE_PROJECT_ID so different Lovable projects keep
 * independent preferences in the same browser.
 */
const VALID: Lang[] = ["es", "en", "ru"];
const projectId = (import.meta as any).env?.VITE_SUPABASE_PROJECT_ID ?? "default";
const STORAGE_KEY = `dashboard:preview-locale:${projectId}`;

export function usePreviewLocale(defaultLang: Lang = "es"): [Lang, (l: Lang) => void] {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return defaultLang;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && VALID.includes(stored as Lang)) return stored as Lang;
    } catch { /* ignore */ }
    return defaultLang;
  });

  // Sync across tabs / windows.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue && VALID.includes(e.newValue as Lang)) {
        setLangState(e.newValue as Lang);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { window.localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
  };

  return [lang, setLang];
}
