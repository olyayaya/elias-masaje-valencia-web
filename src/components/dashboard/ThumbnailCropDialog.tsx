import { useRef, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { useI18n } from "@/i18n/context";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CROP_DEFAULTS, CROP_LIMITS, clampCrop, cropForSave, type GalleryCrop } from "@/lib/gallery-crop";
import CropThumb from "@/components/gallery/CropThumb";


type UiLang = "en" | "es" | "ru";

export const CROP_COPY = {
  adjust: { en: "Adjust thumbnail", es: "Ajustar miniatura", ru: "Настроить миниатюру" },
  title: { en: "Adjust thumbnail", es: "Ajustar miniatura", ru: "Настроить миниатюру" },
  hint: {
    en: "Drag the image to choose what the 4:3 tile shows. The original file is never modified.",
    es: "Arrastra la imagen para elegir lo que muestra el recuadro 4:3. El archivo original no se modifica.",
    ru: "Перетащите изображение, чтобы выбрать кадр 4:3. Оригинальный файл не изменяется.",
  },
  noPoster: {
    en: "This video has no cover image yet. Generate or choose a cover first, then you can adjust the thumbnail.",
    es: "Este vídeo aún no tiene portada. Genera o elige una portada y después podrás ajustar la miniatura.",
    ru: "У этого видео пока нет обложки. Сначала создайте или выберите обложку — затем можно настроить миниатюру.",
  },
  x: { en: "Horizontal position", es: "Posición horizontal", ru: "Положение по горизонтали" },
  y: { en: "Vertical position", es: "Posición vertical", ru: "Положение по вертикали" },
  zoom: { en: "Zoom", es: "Zoom", ru: "Масштаб" },
  reset: { en: "Reset", es: "Restablecer", ru: "Сбросить" },
  cancel: { en: "Cancel", es: "Cancelar", ru: "Отмена" },
  save: { en: "Save", es: "Guardar", ru: "Сохранить" },
  saved: { en: "Thumbnail updated", es: "Miniatura actualizada", ru: "Миниатюра обновлена" },
  saveFailed: { en: "Failed to save", es: "Error al guardar", ru: "Не удалось сохранить" },
} as const;

const useCropCopy = () => {
  const { locale } = useI18n();
  const ui: UiLang = (["en", "es", "ru"] as const).includes(locale as UiLang) ? (locale as UiLang) : "en";
  return (k: keyof typeof CROP_COPY) => CROP_COPY[k][ui];
};

interface Props {
  open: boolean;
  /** Image the preview frames: media_url for photos, poster_url for videos. */
  previewUrl: string;
  value: Partial<GalleryCrop>;
  onCancel: () => void;
  onSave: (crop: GalleryCrop) => Promise<boolean>;
}

const ThumbnailCropDialog = ({ open, previewUrl, value, onCancel, onSave }: Props) => {
  const c = useCropCopy();
  const [draft, setDraft] = useState<GalleryCrop>(() => clampCrop(value));
  const [saving, setSaving] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);

  const set = (patch: Partial<GalleryCrop>) => setDraft((d) => clampCrop({ ...d, ...patch }));

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, cx: draft.thumbnail_x, cy: draft.thumbnail_y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    e.preventDefault();
    const rect = frameRef.current?.getBoundingClientRect();
    const w = rect?.width || 1;
    const h = rect?.height || 1;
    const z = draft.thumbnail_zoom || 1;
    set({
      thumbnail_x: d.cx - ((e.clientX - d.x) / w) * 100 / z,
      thumbnail_y: d.cy - ((e.clientY - d.y) / h) * 100 / z,
    });
  };
  const endDrag = () => {
    drag.current = null;
  };

  const save = async () => {
    setSaving(true);
    const ok = await onSave(cropForSave(draft));
    setSaving(false);
    if (ok) onCancel();
  };

  const hasPreview = !!previewUrl && previewUrl.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-md" data-testid="thumbnail-crop-dialog">
        <DialogHeader>
          <DialogTitle>{c("title")}</DialogTitle>
          <DialogDescription>{hasPreview ? c("hint") : c("noPoster")}</DialogDescription>
        </DialogHeader>

        {hasPreview && (
          <div className="space-y-4">
            <div
              ref={frameRef}
              data-testid="crop-frame"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              className="relative w-full overflow-hidden rounded-lg bg-secondary touch-none cursor-grab active:cursor-grabbing select-none"
              style={{ aspectRatio: "4 / 3" }}
            >
              <div className="absolute inset-0 pointer-events-none">
                <CropThumb src={previewUrl} alt="" crop={draft} testId="crop-preview-img" />
              </div>
            </div>


            <div className="space-y-3">
              <div>
                <label htmlFor="crop-x" className="text-xs text-muted-foreground">
                  {c("x")}: {Math.round(draft.thumbnail_x)}%
                </label>
                <Slider
                  id="crop-x"
                  aria-label={c("x")}
                  min={CROP_LIMITS.x.min}
                  max={CROP_LIMITS.x.max}
                  step={1}
                  value={[draft.thumbnail_x]}
                  onValueChange={([v]) => set({ thumbnail_x: v })}
                />
              </div>
              <div>
                <label htmlFor="crop-y" className="text-xs text-muted-foreground">
                  {c("y")}: {Math.round(draft.thumbnail_y)}%
                </label>
                <Slider
                  id="crop-y"
                  aria-label={c("y")}
                  min={CROP_LIMITS.y.min}
                  max={CROP_LIMITS.y.max}
                  step={1}
                  value={[draft.thumbnail_y]}
                  onValueChange={([v]) => set({ thumbnail_y: v })}
                />
              </div>
              <div>
                <label htmlFor="crop-zoom" className="text-xs text-muted-foreground">
                  {c("zoom")}: {draft.thumbnail_zoom.toFixed(2)}×
                </label>
                <Slider
                  id="crop-zoom"
                  aria-label={c("zoom")}
                  min={CROP_LIMITS.zoom.min}
                  max={CROP_LIMITS.zoom.max}
                  step={0.05}
                  value={[draft.thumbnail_zoom]}
                  onValueChange={([v]) => set({ thumbnail_zoom: v })}
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          {hasPreview && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDraft({ ...CROP_DEFAULTS })}
              data-testid="crop-reset"
            >
              <RotateCcw size={14} className="mr-1.5" /> {c("reset")}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onCancel} data-testid="crop-cancel">
            {c("cancel")}
          </Button>
          {hasPreview && (
            <Button type="button" onClick={save} disabled={saving} data-testid="crop-save">
              {saving && <Loader2 size={14} className="mr-1.5 animate-spin" />}
              {c("save")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ThumbnailCropDialog;
