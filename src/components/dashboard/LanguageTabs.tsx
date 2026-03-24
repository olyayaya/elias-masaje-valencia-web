import { Globe } from "lucide-react";

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
}: {
  active: Lang;
  onChange: (l: Lang) => void;
}) => (
  <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg w-fit">
    <Globe size={14} className="text-gray-400 mx-1.5" />
    {LANGS.map(({ code, label }) => (
      <button
        key={code}
        onClick={() => onChange(code)}
        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
          active === code
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        {label}
      </button>
    ))}
  </div>
);

export default LanguageTabs;
