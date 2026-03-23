import { useI18n } from "@/i18n/context";
import { Locale } from "@/i18n/types";
import { Globe } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const labels: Record<Locale, string> = { es: "ES", en: "EN", ru: "RU" };

const LanguageSwitcher = () => {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-sm font-body text-muted-foreground hover:text-primary transition-colors"
        aria-label="Change language"
      >
        <Globe size={16} />
        <span>{labels[locale]}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 bg-background border border-border rounded shadow-soft py-1 min-w-[80px] z-50">
          {(Object.keys(labels) as Locale[]).map((l) => (
            <button
              key={l}
              onClick={() => { setLocale(l); setOpen(false); }}
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
