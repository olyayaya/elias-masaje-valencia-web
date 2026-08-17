import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Sparkles, X } from "lucide-react";
import { useI18n } from "@/i18n/context";
import { MAX_ALT_LENGTH, type AltLang } from "@/lib/alt-text";
import { ALT_LANGS, planAltTranslations, planToTriple, type AltTriple } from "@/lib/alt-translate";

const COPY = {
  title: { en: "Review translated alt text", es: "Revisa el texto alternativo traducido", ru: "Проверьте перевод alt-текста" },
  desc: {
    en: "Translated from {l}. Machine translations are marked — check them before saving.",
    es: "Traducido desde {l}. Las traducciones automáticas están marcadas — revísalas antes de guardar.",
    ru: "Переведено с {l}. Автопереводы отмечены — проверьте их перед сохранением.",
  },
  source: { en: "Source", es: "Origen", ru: "Источник" },
  auto: { en: "Auto — needs review", es: "Automático — revisar", ru: "Автоперевод — проверьте" },
  kept: { en: "Kept your text", es: "Se mantiene tu texto", ru: "Оставлен ваш текст" },
  overwrite: { en: "Replace with the translation", es: "Sustituir por la traducción", ru: "Заменить переводом" },
  save: { en: "Save all three", es: "Guardar los tres", ru: "Сохранить все три" },
  cancel: { en: "Cancel", es: "Cancelar", ru: "Отмена" },
} as const;

const fill = (s: string, vars: Record<string, string>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(v), s);

export interface AltTranslateReviewProps {
  open: boolean;
  source: AltLang;
  sourceValue: string;
  current: AltTriple;
  translations: Partial<Record<AltLang, string>>;
  saving?: boolean;
  onCancel: () => void;
  onConfirm: (values: AltTriple) => void;
}

const AltTranslateReview = ({
  open, source, sourceValue, current, translations, saving, onCancel, onConfirm,
}: AltTranslateReviewProps) => {
  const { locale } = useI18n();
  const ui = (["en", "es", "ru"] as const).includes(locale as AltLang) ? (locale as AltLang) : "en";
  const L = (k: keyof typeof COPY, vars: Record<string, string> = {}) => fill(COPY[k][ui], vars);

  const [overwrite, setOverwrite] = useState<Partial<Record<AltLang, boolean>>>({});
  const [edits, setEdits] = useState<Partial<AltTriple>>({});

  useEffect(() => {
    if (open) {
      setOverwrite({});
      setEdits({});
    }
  }, [open, sourceValue]);

  const plan = useMemo(
    () => planAltTranslations({ current, source, sourceValue, translations, overwrite }),
    [current, source, sourceValue, translations, overwrite],
  );

  const values = { ...planToTriple(plan), ...edits } as AltTriple;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            {L("title")}
          </DialogTitle>
          <DialogDescription>{L("desc", { l: source.toUpperCase() })}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {ALT_LANGS.map((lang) => {
            const row = plan.find((r) => r.lang === lang)!;
            return (
              <div key={lang} className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="font-medium text-foreground">{lang.toUpperCase()}</span>
                  {lang === source && (
                    <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary">{L("source")}</span>
                  )}
                  {row.auto && (
                    <span data-testid={`auto-${lang}`} className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
                      {L("auto")}
                    </span>
                  )}
                  {row.conflict && (
                    <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{L("kept")}</span>
                  )}
                </div>
                <Input
                  aria-label={`alt-${lang}`}
                  value={values[lang] ?? ""}
                  maxLength={MAX_ALT_LENGTH}
                  // The source is what was already saved and what the targets were
                  // translated from — editing it here would leave stale targets.
                  readOnly={lang === source}
                  disabled={lang === source}
                  onChange={(e) => setEdits((p) => ({ ...p, [lang]: e.target.value }))}
                />

                {row.conflict && (
                  <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!overwrite[lang]}
                      onChange={(e) => {
                        setEdits((p) => {
                          const n = { ...p };
                          delete n[lang];
                          return n;
                        });
                        setOverwrite((p) => ({ ...p, [lang]: e.target.checked }));
                      }}
                    />
                    {L("overwrite")}
                  </label>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X size={14} className="mr-1.5" />
            {L("cancel")}
          </Button>
          <Button size="sm" disabled={saving} onClick={() => onConfirm(values)}>
            <Check size={14} className="mr-1.5" />
            {L("save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AltTranslateReview;
