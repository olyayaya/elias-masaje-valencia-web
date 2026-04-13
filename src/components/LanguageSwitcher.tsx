import { useI18n } from "@/i18n/context";
import { Locale } from "@/i18n/types";
import { Globe } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";

const labels: Record<Locale, string> = { es: "ES", en: "EN", ru: "RU" };
const locales: Locale[] = ["es", "en", "ru"];

const LanguageSwitcher = () => {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [focusIdx, setFocusIdx] = useState(-1);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Focus management
  useEffect(() => {
    if (open && focusIdx >= 0) {
      itemRefs.current[focusIdx]?.focus();
    }
  }, [open, focusIdx]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
        setFocusIdx(0);
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setOpen(false);
        setFocusIdx(-1);
        break;
      case "ArrowDown":
        e.preventDefault();
        setFocusIdx(prev => (prev + 1) % locales.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusIdx(prev => (prev - 1 + locales.length) % locales.length);
        break;
    }
  }, [open]);

  return (
    <div ref={ref} className="relative" onKeyDown={handleKeyDown}>
      <button
        onClick={() => { setOpen(!open); if (!open) setFocusIdx(0); }}
        className="flex items-center gap-1.5 text-sm font-body text-muted-foreground hover:text-primary transition-colors"
        aria-label={t.a11y.changeLanguage}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Globe size={16} />
        <span>{labels[locale]}</span>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-2 bg-background border border-border rounded shadow-soft py-1 min-w-[80px] z-50"
          role="listbox"
          aria-label={t.a11y.changeLanguage}
        >
          {locales.map((l, i) => (
            <button
              key={l}
              ref={el => { itemRefs.current[i] = el; }}
              onClick={() => { setLocale(l); setOpen(false); }}
              role="option"
              aria-selected={l === locale}
              className={`block w-full text-left px-4 py-2 text-sm font-body transition-colors hover:bg-secondary ${
                l === locale ? "text-primary font-medium" : "text-muted-foreground"
              }`}
            >
              {labels[l]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
