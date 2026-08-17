import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Check, X } from "lucide-react";
import { useI18n } from "@/i18n/context";
import { MAX_ALT_LENGTH, validateAlt, type AltLang } from "@/lib/alt-text";
import { ALT_LANGS, planAltTranslations, planToTriple, translateAlt, type AltTriple } from "@/lib/alt-translate";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

const COPY = {
  title: { en: "Describe this image", es: "Describe esta imagen", ru: "Опишите изображение" },
  desc: {
    en: "The alt text is stored in the {l} version of this content. Write one short sentence describing what is shown — not a list of keywords.",
    es: "El texto alternativo se guarda en la versión {l} de este contenido. Escribe una frase corta que describa lo que se ve, no una lista de palabras clave.",
    ru: "Alt-текст сохраняется в версии {l} этого контента. Напишите одно короткое предложение о том, что изображено, а не список ключевых слов.",
  },
  label: { en: "Alt text ({l})", es: "Texto alternativo ({l})", ru: "Alt-текст ({l})" },
  placeholder: {
    en: "e.g. Back massage in the Valencia studio",
    es: "p. ej. Masaje de espalda en el estudio de Valencia",
    ru: "напр. Массаж спины в студии в Валенсии",
  },
  decorative: { en: "Decorative image (no alt text needed)", es: "Imagen decorativa (no necesita texto alternativo)", ru: "Декоративное изображение (alt не нужен)" },
  decorativeHint: {
    en: "Screen readers will skip it. Only use this when the image adds no information.",
    es: "Los lectores de pantalla la omitirán. Úsalo solo si la imagen no aporta información.",
    ru: "Скринридеры пропустят его. Используйте только если изображение не несёт информации.",
  },
  empty: { en: "Add a short description, or mark the image as decorative.", es: "Añade una descripción corta o marca la imagen como decorativa.", ru: "Добавьте короткое описание или отметьте изображение как декоративное." },
  tooLong: { en: "Keep it under {n} characters.", es: "Mantenlo por debajo de {n} caracteres.", ru: "Не длиннее {n} символов." },
  save: { en: "Save alt text", es: "Guardar texto alternativo", ru: "Сохранить alt-текст" },
  insert: { en: "Insert image", es: "Insertar imagen", ru: "Вставить изображение" },
  cancel: { en: "Cancel", es: "Cancelar", ru: "Отмена" },
  translate: { en: "Translate to the other languages", es: "Traducir a los demás idiomas", ru: "Перевести на остальные языки" },
  translating: { en: "Translating…", es: "Traduciendo…", ru: "Перевод…" },
  autoBadge: { en: "Auto — needs review", es: "Automático — revisar", ru: "Автоперевод — проверьте" },
  keptBadge: { en: "Kept your text", es: "Se mantiene tu texto", ru: "Оставлен ваш текст" },
  overwrite: { en: "Replace with the translation", es: "Sustituir por la traducción", ru: "Заменить переводом" },
  otherLangs: {
    en: "Other languages — applied only where this image already exists",
    es: "Otros idiomas — se aplica solo donde esta imagen ya existe",
    ru: "Другие языки — применяется только там, где это изображение уже есть",
  },
  translateFailed: {
    en: "Translation failed — the {l} alt text still works",
    es: "La traducción falló — el texto alternativo en {l} sigue disponible",
    ru: "Перевод не удался — alt-текст на {l} сохраняется",
  },
} as const;

const fill = (s: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(String(v)), s);

export interface ImageAltDialogProps {
  open: boolean;
  src: string;
  lang: AltLang;
  initialAlt?: string;
  initialDecorative?: boolean;
  /** Alt already present for this same image in the other language versions. */
  initialOthers?: Partial<AltTriple>;
  /** "insert" while placing a new image, "edit" when changing an existing one. */
  mode?: "insert" | "edit";
  onCancel: () => void;
  onConfirm: (alt: string, decorative: boolean, values: AltTriple) => void;
}

const ImageAltDialog = ({
  open, src, lang, initialAlt = "", initialDecorative = false, initialOthers = {}, mode = "insert", onCancel, onConfirm,
}: ImageAltDialogProps) => {
  const { locale } = useI18n();
  const ui = (["en", "es", "ru"] as const).includes(locale as AltLang) ? (locale as AltLang) : "en";
  const L = (k: keyof typeof COPY, vars: Record<string, string | number> = {}) => fill(COPY[k][ui], vars);

  const [alt, setAlt] = useState(initialAlt);
  const [decorative, setDecorative] = useState(initialDecorative);
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [translations, setTranslations] = useState<Partial<AltTriple>>({});
  /** Exactly which source text/lang produced `translations` — guards against stale results. */
  const [translatedFor, setTranslatedFor] = useState<{ text: string; lang: AltLang } | null>(null);
  const [failed, setFailed] = useState(false);
  const [overwrite, setOverwrite] = useState<Partial<Record<AltLang, boolean>>>({});
  const [edits, setEdits] = useState<Partial<AltTriple>>({});
  const reqRef = useRef(0);

  useEffect(() => {
    if (open) {
      setAlt(initialAlt);
      setDecorative(initialDecorative);
      setTranslations({});
      setTranslatedFor(null);
      setFailed(false);
      setOverwrite({});
      setEdits({});
      setBusy(false);
      reqRef.current += 1;
    } else {
      // Closing invalidates any in-flight request.
      reqRef.current += 1;
    }
  }, [open, initialAlt, initialDecorative]);

  const current: AltTriple = {
    es: lang === "es" ? initialAlt : initialOthers.es ?? "",
    en: lang === "en" ? initialAlt : initialOthers.en ?? "",
    ru: lang === "ru" ? initialAlt : initialOthers.ru ?? "",
  };

  const fresh = !!translatedFor && translatedFor.lang === lang && translatedFor.text === alt.trim();
  const plan = planAltTranslations({
    current,
    source: lang,
    sourceValue: alt,
    translations: fresh ? translations : {},
    overwrite,
  });
  const values = { ...planToTriple(plan), ...edits } as AltTriple;

  /** Any change to the source invalidates the machine translations (never manual edits). */
  const changeAlt = (v: string) => {
    setAlt(v);
    if (translatedFor && translatedFor.text !== v.trim()) {
      setTranslations({});
      setTranslatedFor(null);
    }
    setFailed(false);
  };

  const runTranslate = async (): Promise<boolean> => {
    const text = alt.trim();
    const token = ++reqRef.current;
    setBusy(true);
    setFailed(false);
    try {
      const result = await translateAlt(text, lang);
      // Late answer of an outdated request (source changed / dialog closed): ignore it.
      if (token !== reqRef.current) return false;
      setTranslations(result);
      setTranslatedFor({ text, lang });
      setBusy(false);
      return true;
    } catch {
      if (token !== reqRef.current) return false;
      setFailed(true);
      toast.error(L("translateFailed", { l: lang.toUpperCase() }));
      setBusy(false);
      return false;
    }
  };

  const error = validateAlt(alt, decorative);

  const confirm = (triple: AltTriple) =>
    onConfirm(decorative ? "" : alt.trim(), decorative, decorative ? { es: "", en: "", ru: "" } : triple);

  /** Needs a translation round before anything is written. */
  const needsTranslation = !decorative && autoTranslate && !!alt.trim() && !fresh;

  const handleSave = async () => {
    if (error || busy) return;
    if (needsTranslation) {
      // Save with auto-translate on runs the translation itself and keeps the
      // dialog open so the three languages can be reviewed first.
      await runTranslate();
      return;
    }
    confirm(values);
  };


  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{L("title")}</DialogTitle>
          <DialogDescription>{L("desc", { l: lang.toUpperCase() })}</DialogDescription>
        </DialogHeader>

        {src && (
          <img src={src} alt="" className="w-full max-h-48 object-contain rounded-lg bg-muted" />
        )}

        <div className="space-y-2">
          <label htmlFor="alt-text-input" className="text-xs font-medium text-muted-foreground block">
            {L("label", { l: lang.toUpperCase() })}
          </label>
          <Input
            id="alt-text-input"
            value={alt}
            maxLength={MAX_ALT_LENGTH}
            disabled={decorative}
            onChange={(e) => setAlt(e.target.value)}
            placeholder={L("placeholder")}
          />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{alt.trim().length}/{MAX_ALT_LENGTH}</span>
          </div>

          <label className="flex items-start gap-2 text-xs text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={decorative}
              onChange={(e) => setDecorative(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              {L("decorative")}
              <span className="block text-[11px] text-muted-foreground">{L("decorativeHint")}</span>
            </span>
          </label>

          {error && (
            <p role="alert" className="flex items-center gap-1.5 text-[11px] text-destructive">
              <AlertTriangle size={12} />
              {error === "empty" ? L("empty") : L("tooLong", { n: MAX_ALT_LENGTH })}
            </p>
          )}
        </div>

        {!decorative && (
          <div className="space-y-2 border-t border-border pt-3">
            <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={autoTranslate} onChange={(e) => setAutoTranslate(e.target.checked)} />
              {L("translate")}
            </label>
            {autoTranslate && (
              <>
                <Button type="button" variant="outline" size="sm" disabled={busy || !alt.trim()} onClick={runTranslate}>
                  {busy ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Sparkles size={14} className="mr-1.5" />}
                  {busy ? L("translating") : L("translate")}
                </Button>
                <p className="text-[11px] text-muted-foreground">{L("otherLangs")}</p>
                {ALT_LANGS.filter((l) => l !== lang).map((l) => {
                  const row = plan.find((r) => r.lang === l)!;
                  return (
                    <div key={l} className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="font-medium text-foreground">{l.toUpperCase()}</span>
                        {row.auto && (
                          <span data-testid={`auto-${l}`} className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
                            {L("autoBadge")}
                          </span>
                        )}
                        {row.conflict && <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{L("keptBadge")}</span>}
                      </div>
                      <Input
                        aria-label={`alt-${l}`}
                        value={values[l] ?? ""}
                        maxLength={MAX_ALT_LENGTH}
                        onChange={(e) => setEdits((p) => ({ ...p, [l]: e.target.value }))}
                      />
                      {row.conflict && (
                        <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!overwrite[l]}
                            onChange={(e) => {
                              setEdits((p) => {
                                const n = { ...p };
                                delete n[l];
                                return n;
                              });
                              setOverwrite((p) => ({ ...p, [l]: e.target.checked }));
                            }}
                          />
                          {L("overwrite")}
                        </label>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X size={14} className="mr-1.5" />
            {L("cancel")}
          </Button>
          <Button
            size="sm"
            disabled={!!error}
            onClick={() =>
              onConfirm(
                decorative ? "" : alt.trim(),
                decorative,
                decorative ? { es: "", en: "", ru: "" } : values,
              )
            }
          >
            <Check size={14} className="mr-1.5" />
            {mode === "edit" ? L("save") : L("insert")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImageAltDialog;
