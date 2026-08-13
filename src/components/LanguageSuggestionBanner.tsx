import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n/context";
import { Locale } from "@/i18n/types";
import { X, Globe } from "lucide-react";

const DISMISSED_KEY = "lang-suggestion-dismissed";

const messages: Record<"en" | "ru", { text: string; cta: string }> = {
  en: { text: "This site is also available in English.", cta: "Switch to English" },
  ru: { text: "Этот сайт доступен на русском языке.", cta: "Перейти на русский" },
};

const prefixMap: Record<string, Locale> = { en: "en", ru: "ru" };

function detectSuggestedLocale(current: Locale): "en" | "ru" | null {
  if (current !== "es") return null;
  try {
    const langs = navigator.languages ?? [navigator.language];
    for (const lang of langs) {
      const code = lang.slice(0, 2).toLowerCase();
      if (code in prefixMap && prefixMap[code] !== current) {
        return code as "en" | "ru";
      }
    }
  } catch {
    // SSR or unavailable
  }
  return null;
}

const LanguageSuggestionBanner = () => {
  const { locale } = useI18n();
  const navigate = useNavigate();
  const [suggested, setSuggested] = useState<"en" | "ru" | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(DISMISSED_KEY)) return;
    const s = detectSuggestedLocale(locale);
    if (s) {
      setSuggested(s);
      // Small delay so it animates in after page load
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, [locale]);

  const dismiss = () => {
    setVisible(false);
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setTimeout(() => setSuggested(null), 300);
  };

  const switchLang = () => {
    if (!suggested) return;
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
    navigate(`/${suggested}`);
  };

  if (!suggested) return null;

  const msg = messages[suggested];

  return (
    <aside
      aria-label={msg.cta}
      className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] max-w-md w-[calc(100%-2rem)] transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      }`}
    >
      <div className="flex items-center gap-3 bg-card/95 backdrop-blur-md border border-border rounded-xl px-4 py-3 shadow-lg">
        <Globe size={18} aria-hidden="true" className="text-primary-strong shrink-0" />
        <p className="text-sm font-body text-muted-foreground flex-1">{msg.text}</p>
        <button
          onClick={switchLang}
          className="text-sm font-body font-medium text-primary-strong hover:underline whitespace-nowrap min-h-11 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {msg.cta}
        </button>
        <button
          onClick={dismiss}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0 min-h-11 min-w-11 flex items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Dismiss"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
};

export default LanguageSuggestionBanner;
