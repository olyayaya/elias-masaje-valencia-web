import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Check, X } from "lucide-react";
import { useI18n } from "@/i18n/context";
import { MAX_ALT_LENGTH, validateAlt, type AltLang } from "@/lib/alt-text";

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
} as const;

const fill = (s: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(String(v)), s);

export interface ImageAltDialogProps {
  open: boolean;
  src: string;
  lang: AltLang;
  initialAlt?: string;
  initialDecorative?: boolean;
  /** "insert" while placing a new image, "edit" when changing an existing one. */
  mode?: "insert" | "edit";
  onCancel: () => void;
  onConfirm: (alt: string, decorative: boolean) => void;
}

const ImageAltDialog = ({
  open, src, lang, initialAlt = "", initialDecorative = false, mode = "insert", onCancel, onConfirm,
}: ImageAltDialogProps) => {
  const { locale } = useI18n();
  const ui = (["en", "es", "ru"] as const).includes(locale as AltLang) ? (locale as AltLang) : "en";
  const L = (k: keyof typeof COPY, vars: Record<string, string | number> = {}) => fill(COPY[k][ui], vars);

  const [alt, setAlt] = useState(initialAlt);
  const [decorative, setDecorative] = useState(initialDecorative);

  useEffect(() => {
    if (open) {
      setAlt(initialAlt);
      setDecorative(initialDecorative);
    }
  }, [open, initialAlt, initialDecorative]);

  const error = validateAlt(alt, decorative);

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

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X size={14} className="mr-1.5" />
            {L("cancel")}
          </Button>
          <Button
            size="sm"
            disabled={!!error}
            onClick={() => onConfirm(decorative ? "" : alt.trim(), decorative)}
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
