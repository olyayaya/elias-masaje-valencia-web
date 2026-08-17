/**
 * Smart translation of image alt text between ES / EN / RU.
 *
 * The translation itself runs on the protected `ai-content-helper` edge
 * function (JWT + has_role(admin)); the client never sees an API key.
 * Everything below is deliberately pure so the merge rules can be tested
 * without the network: an auto translation NEVER silently overwrites an alt
 * a human already wrote, and a failed translation never clears anything.
 */
import { supabase } from "@/integrations/supabase/client";
import { MAX_ALT_LENGTH, type AltLang } from "@/lib/alt-text";

export const ALT_LANGS: AltLang[] = ["es", "en", "ru"];

export type AltTriple = Record<AltLang, string>;

export interface AltPlanRow {
  lang: AltLang;
  /** Value currently stored for this language. */
  current: string;
  /** Value that would be written. */
  value: string;
  /** True when `value` came from the machine translation (needs review). */
  auto: boolean;
  /** True when a manually written target was kept instead of being overwritten. */
  conflict: boolean;
  changed: boolean;
}

export interface PlanInput {
  current: AltTriple;
  source: AltLang;
  sourceValue: string;
  translations: Partial<Record<AltLang, string>>;
  /** Per-language explicit permission to replace an existing manual value. */
  overwrite?: Partial<Record<AltLang, boolean>>;
}

const trim = (v: string | null | undefined) => (typeof v === "string" ? v.trim() : "");

export function planAltTranslations({
  current,
  source,
  sourceValue,
  translations,
  overwrite = {},
}: PlanInput): AltPlanRow[] {
  return ALT_LANGS.map((lang) => {
    const cur = trim(current[lang]);
    if (lang === source) {
      const value = trim(sourceValue);
      return { lang, current: cur, value, auto: false, conflict: false, changed: value !== cur };
    }
    const proposed = trim(translations[lang]).slice(0, MAX_ALT_LENGTH);
    if (!proposed) {
      return { lang, current: cur, value: cur, auto: false, conflict: false, changed: false };
    }
    if (cur && !overwrite[lang]) {
      return { lang, current: cur, value: cur, auto: false, conflict: true, changed: false };
    }
    return { lang, current: cur, value: proposed, auto: true, conflict: false, changed: proposed !== cur };
  });
}

/** Collapses a plan back into the three values that should be stored. */
export const planToTriple = (plan: AltPlanRow[]): AltTriple =>
  plan.reduce((acc, r) => ({ ...acc, [r.lang]: r.value }), { es: "", en: "", ru: "" } as AltTriple);

export class AltTranslateError extends Error {}

/** Calls the admin-only edge function. Throws on any failure — callers keep the source alt. */
export async function translateAlt(
  text: string,
  source: AltLang,
  targets: AltLang[] = ALT_LANGS.filter((l) => l !== source),
): Promise<Partial<Record<AltLang, string>>> {
  const value = trim(text);
  if (!value) throw new AltTranslateError("empty");
  if (value.length > MAX_ALT_LENGTH * 2) throw new AltTranslateError("tooLong");

  const { data, error } = await supabase.functions.invoke("ai-content-helper", {
    body: { action: "translate_alt", text: value, sourceLang: source, targets },
  });
  if (error) throw new AltTranslateError(error.message || "request failed");
  const translations = (data as { translations?: Record<string, string> } | null)?.translations;
  if (!translations || typeof translations !== "object") throw new AltTranslateError("no translations");

  const out: Partial<Record<AltLang, string>> = {};
  for (const lang of targets) {
    const v = trim(translations[lang]);
    if (v) out[lang] = v.slice(0, MAX_ALT_LENGTH);
  }
  if (Object.keys(out).length === 0) throw new AltTranslateError("no translations");
  return out;
}
