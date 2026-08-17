import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import { useI18n } from "@/i18n/context";
import { altColumn, altStatus, MAX_ALT_LENGTH, type AltLang } from "@/lib/alt-text";
import { translateAlt, type AltTriple } from "@/lib/alt-translate";
import AltTranslateReview from "./AltTranslateReview";
import DashboardCard from "./DashboardCard";
import ImagePicker from "./ImagePicker";
import LanguageTabs, { type Lang } from "./LanguageTabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Trash2, ChevronUp, ChevronDown, Loader2, ImageIcon, ChevronRight, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const COPY = {
  intro: {
    en: "Manage the photo carousels shown across the site. Empty carousels fall back to the built-in default images.",
    es: "Gestiona los carruseles de fotos del sitio. Los carruseles vacíos usan las imágenes por defecto.",
    ru: "Управляйте фото-каруселями сайта. Пустые карусели используют встроенные изображения по умолчанию.",
  },
  altLabel: {
    en: "Alt text ({l}) — short description for SEO & screen readers",
    es: "Texto alternativo ({l}) — descripción corta para SEO y lectores de pantalla",
    ru: "Alt-текст ({l}) — короткое описание для SEO и скринридеров",
  },
  altPlaceholder: {
    en: "e.g. Back massage in the Valencia studio",
    es: "p. ej. Masaje de espalda en el estudio de Valencia",
    ru: "напр. Массаж спины в студии в Валенсии",
  },
  missing: {
    en: "No {l} alt text — the {l} page falls back to the Spanish description",
    es: "Sin texto alternativo en {l} — la página en {l} usa la descripción en español",
    ru: "Нет alt-текста для {l} — страница на {l} использует испанское описание",
  },
  missingEs: {
    en: "No alt text yet. Add one, or leave it empty only if the image is purely decorative.",
    es: "Aún sin texto alternativo. Añade uno o déjalo vacío solo si la imagen es decorativa.",
    ru: "Alt-текст ещё не задан. Добавьте его или оставьте пустым только для декоративного изображения.",
  },
  saved: { en: "Alt text saved", es: "Texto alternativo guardado", ru: "Alt-текст сохранён" },
  saveFailed: { en: "Failed to save", es: "Error al guardar", ru: "Не удалось сохранить" },
  defaults: {
    en: "Using built-in default images — add one to override",
    es: "Usando las imágenes por defecto — añade una para sustituirlas",
    ru: "Используются изображения по умолчанию — добавьте своё, чтобы заменить",
  },
  addImage: { en: "Add image", es: "Añadir imagen", ru: "Добавить изображение" },
  added: { en: "Image added", es: "Imagen añadida", ru: "Изображение добавлено" },
  addFailed: { en: "Failed to add image", es: "Error al añadir la imagen", ru: "Не удалось добавить изображение" },
  updated: { en: "Image updated", es: "Imagen actualizada", ru: "Изображение обновлено" },
  updateFailed: { en: "Failed to update", es: "Error al actualizar", ru: "Не удалось обновить" },
  removed: { en: "Removed", es: "Eliminada", ru: "Удалено" },
  removeFailed: { en: "Failed to remove", es: "Error al eliminar", ru: "Не удалось удалить" },
  confirmRemove: { en: "Remove this image from the carousel?", es: "¿Quitar esta imagen del carrusel?", ru: "Удалить это изображение из карусели?" },
  autoTranslate: { en: "Translate to the other languages on save", es: "Traducir a los demás idiomas al guardar", ru: "Переводить на остальные языки при сохранении" },
  translating: { en: "Translating…", es: "Traduciendo…", ru: "Перевод…" },
  translateFailed: {
    en: "Translation failed — your alt text was saved",
    es: "La traducción falló — tu texto alternativo se guardó",
    ru: "Перевод не удался — ваш alt-текст сохранён",
  },
} as const;

const fill = (s: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(String(v)), s);

const useCopy = () => {
  const { locale } = useI18n();
  const ui = (["en", "es", "ru"] as const).includes(locale as AltLang) ? (locale as AltLang) : "en";
  return (k: keyof typeof COPY, vars: Record<string, string | number> = {}) => fill(COPY[k][ui], vars);
};

interface PageImage {
  id: string;
  collection_key: string;
  image_url: string;
  alt_text: string;
  alt_text_en: string | null;
  alt_text_ru: string | null;
  sort_order: number;
}

const COLLECTIONS: { key: string; label: string; description: string }[] = [
  { key: "home_carousel", label: "Homepage Carousel", description: "Image carousel on the landing page services section" },
  { key: "services_carousel", label: "Services Page Carousel", description: "Carousel shown on the /servicios page" },
  { key: "about_carousel", label: "About Me Gallery", description: "Image carousel on the /sobre-mi page" },
];

const CollectionSection = ({
  collection,
  images,
  onChange,
}: {
  collection: { key: string; label: string; description: string };
  images: PageImage[];
  onChange: () => void;
}) => {
  const L = useCopy();
  const [open, setOpen] = useState(false);
  const [altLang, setAltLang] = useState<Lang>("es");
  const [pickerForId, setPickerForId] = useState<string | null>(null);
  const [pickerForNew, setPickerForNew] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [translating, setTranslating] = useState<string | null>(null);
  const [review, setReview] = useState<{
    img: PageImage;
    source: AltLang;
    sourceValue: string;
    current: AltTriple;
    translations: Partial<Record<AltLang, string>>;
  } | null>(null);
  /** Monotonic token so a late translation answer cannot open a stale review. */
  const translateReq = useRef(0);


  useEffect(() => {
    const d: Record<string, string> = {};
    images.forEach((i) => (d[`${i.id}:${altLang}`] = (i[altColumn(altLang as AltLang)] as string | null) ?? ""));
    setDrafts((prev) => ({ ...prev, ...d }));
  }, [images, altLang]);


  const addImage = async (url: string) => {
    setBusy("new");
    const nextOrder = images.length ? Math.max(...images.map((i) => i.sort_order)) + 1 : 0;
    const { error } = await supabase.from("page_images").insert({
      collection_key: collection.key,
      image_url: url,
      alt_text: "",
      sort_order: nextOrder,
    });
    if (error) toast.error(L("addFailed"));
    else {
      toast.success(L("added"));
      onChange();
    }
    setBusy(null);
  };

  const updateUrl = async (id: string, url: string) => {
    setBusy(id);
    const { error } = await supabase.from("page_images").update({ image_url: url }).eq("id", id);
    if (error) toast.error(L("updateFailed"));
    else {
      toast.success(L("updated"));
      onChange();
    }
    setBusy(null);
  };

  /** Saves only the column of the active language, so ES/EN/RU stay independent. */
  const updateAlt = async (img: PageImage) => {
    const col = altColumn(altLang as AltLang);
    const next = drafts[`${img.id}:${altLang}`] ?? "";
    if (next === ((img[col] as string | null) ?? "")) return;
    setBusy(img.id + "-alt");
    const patch = { [col]: next } as { alt_text?: string; alt_text_en?: string; alt_text_ru?: string };
    const { error } = await supabase.from("page_images").update(patch).eq("id", img.id);
    if (error) {
      toast.error(L("saveFailed"));
      setBusy(null);
      onChange();
      return;
    }
    toast.success(L("saved"));
    setBusy(null);
    onChange();

    // Auto-translate only this row, only after an explicit save action.
    if (!autoTranslate || !next.trim()) return;
    const token = ++translateReq.current;
    setTranslating(img.id);
    try {
      const translations = await translateAlt(next, altLang as AltLang);
      // A newer save (other row, other language, edited text) already superseded
      // this request — drop the stale answer instead of opening a wrong review.
      if (token !== translateReq.current) return;
      setReview({
        img,
        source: altLang as AltLang,
        sourceValue: next,
        current: {
          es: altLang === "es" ? next : img.alt_text ?? "",
          en: altLang === "en" ? next : img.alt_text_en ?? "",
          ru: altLang === "ru" ? next : img.alt_text_ru ?? "",
        },
        translations,
      });
    } catch {
      if (token === translateReq.current) toast.error(L("translateFailed"));
    }
    if (token === translateReq.current) setTranslating(null);
  };


  /** Writes the three reviewed values in one update; source alt is already saved. */
  const saveReviewed = async (values: AltTriple) => {
    if (!review) return;
    setBusy(review.img.id + "-alt");
    const { error } = await supabase
      .from("page_images")
      .update({ alt_text: values.es, alt_text_en: values.en, alt_text_ru: values.ru })
      .eq("id", review.img.id);
    setBusy(null);
    if (error) toast.error(L("saveFailed"));
    else toast.success(L("saved"));
    setReview(null);
    onChange();
  };


  const remove = async (id: string) => {
    if (!confirm(L("confirmRemove"))) return;
    setBusy(id);
    const { error } = await supabase.from("page_images").delete().eq("id", id);
    if (error) toast.error(L("removeFailed"));
    else {
      toast.success(L("removed"));
      onChange();
    }
    setBusy(null);
  };

  const move = async (img: PageImage, direction: -1 | 1) => {
    const sorted = [...images].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((i) => i.id === img.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    setBusy(img.id);
    await supabase.from("page_images").update({ sort_order: other.sort_order }).eq("id", img.id);
    await supabase.from("page_images").update({ sort_order: img.sort_order }).eq("id", other.id);
    setBusy(null);
    onChange();
  };

  const sorted = [...images].sort((a, b) => a.sort_order - b.sort_order);
  const usingDefaults = sorted.length === 0;
  const langUpper = altLang.toUpperCase();

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full text-left">
        <DashboardCard title={collection.label} description={collection.description}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
            <ChevronRight size={14} className={`transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
            <span>
              {usingDefaults
                ? L("defaults")
                : `${sorted.length} image${sorted.length === 1 ? "" : "s"}`}
            </span>
          </div>
        </DashboardCard>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border border-t-0 border-border rounded-b-lg bg-card px-5 pb-5 pt-3 space-y-3">
          {sorted.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <LanguageTabs active={altLang} onChange={setAltLang} />
              <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoTranslate}
                  onChange={(e) => setAutoTranslate(e.target.checked)}
                />
                {L("autoTranslate")}
              </label>
              {translating && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Loader2 size={11} className="animate-spin" />
                  {L("translating")}
                </span>
              )}
            </div>
          )}
          {sorted.map((img, i) => {
            const status = altStatus(img);
            const draftKey = `${img.id}:${altLang}`;
            const value = drafts[draftKey] ?? "";
            const missing = !value.trim();
            return (
            <div key={img.id} className="flex flex-col sm:flex-row gap-3 items-start p-3 rounded-lg bg-secondary/40">
              <div className="w-20 h-20 rounded-md overflow-hidden bg-background shrink-0">
                <img src={img.image_url} alt={img.alt_text} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 space-y-1.5 min-w-0 w-full">
                <div className="flex gap-1.5">
                  <Input
                    value={img.image_url}
                    readOnly
                    className="text-xs font-mono"
                  />
                  <Button size="sm" variant="outline" onClick={() => setPickerForId(img.id)} className="h-10 shrink-0">
                    <ImageIcon size={14} />
                  </Button>
                </div>
                <label className="text-[11px] text-muted-foreground block" htmlFor={`alt-${img.id}`}>
                  {L("altLabel", { l: langUpper })}
                </label>
                <Input
                  id={`alt-${img.id}`}
                  value={value}
                  maxLength={MAX_ALT_LENGTH}
                  onChange={(e) => setDrafts((p) => ({ ...p, [draftKey]: e.target.value }))}
                  onBlur={() => updateAlt(img)}
                  placeholder={L("altPlaceholder")}
                  className="text-sm"
                />
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  {(["es", "en", "ru"] as AltLang[]).map((l) => (
                    <span
                      key={l}
                      className={`px-1.5 py-0.5 rounded ${status[l] ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                    >
                      {l.toUpperCase()}
                      {status[l] ? " ✓" : " —"}
                    </span>
                  ))}
                  {missing && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <AlertTriangle size={11} />
                      {altLang === "es" ? L("missingEs") : L("missing", { l: langUpper })}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex sm:flex-col gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => move(img, -1)} disabled={i === 0 || !!busy} className="h-7 w-7 p-0">
                  <ChevronUp size={14} />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => move(img, 1)} disabled={i === sorted.length - 1 || !!busy} className="h-7 w-7 p-0">
                  <ChevronDown size={14} />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(img.id)} disabled={!!busy} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                  {busy === img.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </Button>
              </div>
            </div>
          );})}

          <Button size="sm" variant="outline" onClick={() => setPickerForNew(true)} disabled={busy === "new"} className="w-full">
            {busy === "new" ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Plus size={14} className="mr-1.5" />}
            {L("addImage")}
          </Button>
        </div>
      </CollapsibleContent>


      {review && (
        <AltTranslateReview
          open
          source={review.source}
          sourceValue={review.sourceValue}
          current={review.current}
          translations={review.translations}
          saving={busy === review.img.id + "-alt"}
          onCancel={() => setReview(null)}
          onConfirm={saveReviewed}
        />
      )}

      <ImagePicker
        open={pickerForNew}
        onClose={() => setPickerForNew(false)}
        onSelect={(url) => addImage(url)}
      />
      <ImagePicker
        open={!!pickerForId}
        onClose={() => setPickerForId(null)}
        onSelect={(url) => pickerForId && updateUrl(pickerForId, url)}
        currentUrl={pickerForId ? images.find((i) => i.id === pickerForId)?.image_url : undefined}
      />
    </Collapsible>
  );
};

const DashboardCarousels = () => {
  const [images, setImages] = useState<PageImage[]>([]);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  const fetchAll = async () => {
    const { data } = await supabase.from("page_images").select("*").order("sort_order", { ascending: true });
    if (data) setImages(data as PageImage[]);
    setLoading(false);
    // Public hooks key by collection — invalidate the whole prefix so every
    // carousel on the site refetches after any add / move / delete.
    queryClient.invalidateQueries({ queryKey: queryKeys.pageImagesAll });
  };

  useEffect(() => {
    fetchAll();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Manage the photo carousels shown across the site. Empty carousels fall back to the built-in default images.
      </p>
      {COLLECTIONS.map((col) => (
        <CollectionSection
          key={col.key}
          collection={col}
          images={images.filter((i) => i.collection_key === col.key)}
          onChange={fetchAll}
        />
      ))}
    </div>
  );
};

export default DashboardCarousels;
