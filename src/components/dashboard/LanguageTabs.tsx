import { Globe, Check } from "lucide-react";

export type Lang = "es" | "en" | "ru";
export const LANGS: { code: Lang; label: string }[] = [
  { code: "es", label: "ES" },
  { code: "en", label: "EN" },
  { code: "ru", label: "RU" },
];

/** Returns the suffixed key for a given language, e.g. ("title", "en") → "title_en". ES uses the base key. */
export const langKey = (base: string, lang: Lang) =>
  lang === "es" ? base : `${base}_${lang}`;

/** Get value from a record using a language-aware key */
export const langVal = (record: Record<string, any>, base: string, lang: Lang): string =>
  (record[langKey(base, lang)] as string) ?? "";

const LanguageTabs = ({
  active,
  onChange,
  contentStatus,
}: {
  active: Lang;
  onChange: (l: Lang) => void;
  /** Optional map indicating which languages have content. undefined = all enabled (legacy behavior) */
  contentStatus?: Record<Lang, boolean>;
}) => (
  <div className="flex items-center gap-1 bg-secondary p-0.5 rounded-lg w-fit">
    <Globe size={14} className="text-muted-foreground mx-1.5" />
    {LANGS.map(({ code, label }) => {
      const hasContent = contentStatus ? contentStatus[code] : true;
      const isActive = active === code;
      return (
        <button
          key={code}
          onClick={() => hasContent && onChange(code)}
          disabled={!hasContent}
          className={`relative px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            isActive
              ? "bg-background text-foreground shadow-sm"
              : hasContent
              ? "text-muted-foreground hover:text-foreground"
              : "text-muted-foreground/40 cursor-not-allowed"
          }`}
          title={hasContent ? label : `${label} — no content yet`}
        >
          <span className="flex items-center gap-1">
            {label}
            {contentStatus && hasContent && !isActive && (
              <Check size={10} className="text-green-500" />
            )}
          </span>
        </button>
      );
    })}
  </div>
);

export default LanguageTabs;
