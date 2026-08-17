import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus, Trash2, ChevronUp, ChevronDown, Loader2, Film, ImageIcon, Eye, EyeOff, AlertTriangle,
} from "lucide-react";
import { useI18n } from "@/i18n/context";
import { queryKeys } from "@/lib/query-keys";
import { galleryTable, isMissingGalleryTable, type GalleryItem } from "@/lib/gallery";
import { useGalleryAdmin } from "@/hooks/use-gallery";
import DashboardCard from "./DashboardCard";
import LanguageTabs, { type Lang } from "./LanguageTabs";
import GalleryMediaPicker from "./GalleryMediaPicker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const COPY = {
  intro: {
    en: "Curate the public Gallery page. Items are shown in this order; unpublished items stay hidden from visitors.",
    es: "Gestiona la página pública de Galería. Los elementos se muestran en este orden; los no publicados quedan ocultos.",
    ru: "Управляйте публичной страницей «Галерея». Элементы показываются в этом порядке; неопубликованные скрыты от посетителей.",
  },
  missingTable: {
    en: "The gallery storage is not set up yet. Ask your developer to apply the pending gallery migration.",
    es: "El almacenamiento de la galería aún no está configurado. Pide que se aplique la migración pendiente.",
    ru: "Хранилище галереи ещё не настроено. Попросите применить ожидающую миграцию.",
  },
  addPhoto: { en: "Add photo", es: "Añadir foto", ru: "Добавить фото" },
  addVideo: { en: "Add video", es: "Añadir vídeo", ru: "Добавить видео" },
  empty: { en: "No gallery items yet.", es: "Aún no hay elementos.", ru: "Пока нет элементов." },
  pickPhoto: { en: "Choose a photo", es: "Elige una foto", ru: "Выберите фото" },
  pickVideo: { en: "Choose a video", es: "Elige un vídeo", ru: "Выберите видео" },
  pickPoster: { en: "Choose a cover image", es: "Elige una imagen de portada", ru: "Выберите обложку" },
  pickerHint: {
    en: "Files come from Dashboard → Library. Upload new files there first.",
    es: "Los archivos vienen de Panel → Biblioteca. Sube allí los archivos nuevos.",
    ru: "Файлы берутся из Панель → Библиотека. Сначала загрузите файлы там.",
  },
  pickerEmpty: { en: "No files of this type in the Library.", es: "No hay archivos de este tipo en la Biblioteca.", ru: "В Библиотеке нет файлов этого типа." },
  cancel: { en: "Cancel", es: "Cancelar", ru: "Отмена" },
  select: { en: "Select", es: "Seleccionar", ru: "Выбрать" },
  changeMedia: { en: "Change file", es: "Cambiar archivo", ru: "Заменить файл" },
  poster: { en: "Video cover", es: "Portada del vídeo", ru: "Обложка видео" },
  posterMissing: {
    en: "No cover image — the grid will show an empty tile until you pick one.",
    es: "Sin portada — la cuadrícula mostrará un hueco hasta que elijas una.",
    ru: "Нет обложки — в сетке будет пустая плитка, пока вы её не выберете.",
  },
  titleLabel: { en: "Title ({l})", es: "Título ({l})", ru: "Заголовок ({l})" },
  descLabel: { en: "Caption ({l})", es: "Descripción ({l})", ru: "Описание ({l})" },
  altLabel: { en: "Alt text ({l}) — for SEO & screen readers", es: "Texto alternativo ({l}) — para SEO y lectores de pantalla", ru: "Alt-текст ({l}) — для SEO и скринридеров" },
  altMissing: {
    en: "No Spanish alt text yet — add one unless the image is purely decorative.",
    es: "Aún sin texto alternativo en español — añádelo salvo que la imagen sea decorativa.",
    ru: "Нет alt-текста на испанском — добавьте его, если изображение не декоративное.",
  },
  published: { en: "Published", es: "Publicado", ru: "Опубликовано" },
  hidden: { en: "Hidden", es: "Oculto", ru: "Скрыто" },
  saved: { en: "Saved", es: "Guardado", ru: "Сохранено" },
  saveFailed: { en: "Failed to save", es: "Error al guardar", ru: "Не удалось сохранить" },
  added: { en: "Item added", es: "Elemento añadido", ru: "Элемент добавлен" },
  removed: { en: "Removed", es: "Eliminado", ru: "Удалено" },
  confirmRemove: { en: "Remove this item from the gallery?", es: "¿Quitar este elemento de la galería?", ru: "Удалить этот элемент из галереи?" },
} as const;

type UiLang = "en" | "es" | "ru";
const fill = (s: string, vars: Record<string, string>) =>
  Object.entries(vars).reduce((a, [k, v]) => a.split(`{${k}}`).join(v), s);

const useCopy = () => {
  const { locale } = useI18n();
  const ui: UiLang = (["en", "es", "ru"] as const).includes(locale as UiLang) ? (locale as UiLang) : "en";
  return (k: keyof typeof COPY, vars: Record<string, string> = {}) => fill(COPY[k][ui], vars);
};

const langName: Record<Lang, string> = { es: "ES", en: "EN", ru: "RU" };

const DashboardGallery = () => {
  const c = useCopy();
  const qc = useQueryClient();
  const { data: items = [], isPending, error } = useGalleryAdmin();
  const [lang, setLang] = useState<Lang>("es");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [picker, setPicker] = useState<
    | null
    | { mode: "add"; kind: "photo" | "video" }
    | { mode: "media"; kind: "photo" | "video"; id: string; currentUrl: string }
    | { mode: "poster"; id: string; currentUrl: string }
  >(null);
  const [drafts, setDrafts] = useState<Record<string, Partial<GalleryItem>>>({});

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: queryKeys.galleryAdmin });
    void qc.invalidateQueries({ queryKey: queryKeys.gallery });
  };

  const patch = async (id: string, values: Record<string, unknown>) => {
    setBusyId(id);
    const { error: err } = await galleryTable().update(values).eq("id", id);
    setBusyId(null);
    if (err) {
      toast.error(c("saveFailed"));
      return false;
    }
    refresh();
    return true;
  };

  const addItem = async (kind: "photo" | "video", url: string) => {
    const maxOrder = items.reduce((m, i) => Math.max(m, i.sort_order), 0);
    const { error: err } = await galleryTable().insert({
      media_type: kind,
      media_url: url,
      poster_url: kind === "photo" ? url : "",
      sort_order: maxOrder + 1,
      published: false,
    });
    if (err) {
      toast.error(c("saveFailed"));
      return;
    }
    toast.success(c("added"));
    refresh();
  };

  const move = async (item: GalleryItem, dir: -1 | 1) => {
    const idx = items.findIndex((i) => i.id === item.id);
    const other = items[idx + dir];
    if (!other) return;
    setBusyId(item.id);
    const a = galleryTable().update({ sort_order: other.sort_order }).eq("id", item.id);
    const b = galleryTable().update({ sort_order: item.sort_order }).eq("id", other.id);
    const [r1, r2] = await Promise.all([a, b]);
    setBusyId(null);
    if (r1.error || r2.error) toast.error(c("saveFailed"));
    refresh();
  };

  const remove = async (item: GalleryItem) => {
    if (!window.confirm(c("confirmRemove"))) return;
    setBusyId(item.id);
    const { error: err } = await galleryTable().delete().eq("id", item.id);
    setBusyId(null);
    if (err) toast.error(c("saveFailed"));
    else {
      toast.success(c("removed"));
      refresh();
    }
  };

  const field = (item: GalleryItem, base: "title" | "description" | "alt") =>
    `${base}_${lang}` as keyof GalleryItem;

  const valueOf = (item: GalleryItem, base: "title" | "description" | "alt") => {
    const key = field(item, base) as string;
    const draft = drafts[item.id]?.[key as keyof GalleryItem];
    return typeof draft === "string" ? draft : ((item as unknown as Record<string, string>)[key] ?? "");
  };

  const setDraft = (id: string, key: string, value: string) =>
    setDrafts((d) => ({ ...d, [id]: { ...d[id], [key]: value } }));

  const commit = async (item: GalleryItem, base: "title" | "description" | "alt") => {
    const key = field(item, base) as string;
    const draft = drafts[item.id]?.[key as keyof GalleryItem];
    if (typeof draft !== "string") return;
    const current = (item as unknown as Record<string, string>)[key] ?? "";
    if (draft === current) return;
    if (await patch(item.id, { [key]: draft })) toast.success(c("saved"));
  };

  if (isMissingGalleryTable(error as { code?: string; message?: string } | null)) {
    return (
      <DashboardCard title="Gallery">
        <p className="text-sm text-muted-foreground flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {c("missingTable")}
        </p>
      </DashboardCard>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{c("intro")}</p>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setPicker({ mode: "add", kind: "photo" })}>
          <Plus size={14} className="mr-1.5" /> {c("addPhoto")}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setPicker({ mode: "add", kind: "video" })}>
          <Film size={14} className="mr-1.5" /> {c("addVideo")}
        </Button>
        <div className="ml-auto">
          <LanguageTabs active={lang} onChange={setLang} />
        </div>
      </div>

      {isPending ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-muted-foreground" size={20} />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8">{c("empty")}</p>
      ) : (
        <div className="space-y-4">
          {items.map((item, idx) => {
            const busy = busyId === item.id;
            const thumb = item.media_type === "video" ? item.poster_url : item.media_url;
            return (
              <DashboardCard key={item.id} title="">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="md:w-48 shrink-0 space-y-2">
                    <div className="aspect-[4/3] rounded-lg overflow-hidden bg-secondary flex items-center justify-center">
                      {thumb ? (
                        <img src={thumb} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Film size={20} className="text-muted-foreground" />
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() =>
                        setPicker({ mode: "media", kind: item.media_type, id: item.id, currentUrl: item.media_url })
                      }
                    >
                      <ImageIcon size={13} className="mr-1.5" /> {c("changeMedia")}
                    </Button>
                    {item.media_type === "video" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => setPicker({ mode: "poster", id: item.id, currentUrl: item.poster_url })}
                        >
                          <ImageIcon size={13} className="mr-1.5" /> {c("poster")}
                        </Button>
                        {!item.poster_url && (
                          <p className="text-[11px] text-muted-foreground">{c("posterMissing")}</p>
                        )}
                      </>
                    )}
                  </div>

                  <div className="flex-1 space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground">
                        {c("titleLabel", { l: langName[lang] })}
                      </label>
                      <Input
                        value={valueOf(item, "title")}
                        onChange={(e) => setDraft(item.id, field(item, "title") as string, e.target.value)}
                        onBlur={() => commit(item, "title")}
                        disabled={busy}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">
                        {c("descLabel", { l: langName[lang] })}
                      </label>
                      <Textarea
                        rows={2}
                        value={valueOf(item, "description")}
                        onChange={(e) => setDraft(item.id, field(item, "description") as string, e.target.value)}
                        onBlur={() => commit(item, "description")}
                        disabled={busy}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">
                        {c("altLabel", { l: langName[lang] })}
                      </label>
                      <Input
                        value={valueOf(item, "alt")}
                        onChange={(e) => setDraft(item.id, field(item, "alt") as string, e.target.value)}
                        onBlur={() => commit(item, "alt")}
                        disabled={busy}
                      />
                      {!item.alt_es && (
                        <p className="text-[11px] text-muted-foreground mt-1">{c("altMissing")}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        variant={item.published ? "default" : "outline"}
                        disabled={busy}
                        onClick={() => patch(item.id, { published: !item.published })}
                      >
                        {item.published ? <Eye size={13} className="mr-1.5" /> : <EyeOff size={13} className="mr-1.5" />}
                        {item.published ? c("published") : c("hidden")}
                      </Button>
                      <Button size="sm" variant="ghost" disabled={busy || idx === 0} onClick={() => move(item, -1)}>
                        <ChevronUp size={14} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy || idx === items.length - 1}
                        onClick={() => move(item, 1)}
                      >
                        <ChevronDown size={14} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        disabled={busy}
                        onClick={() => remove(item)}
                      >
                        <Trash2 size={14} />
                      </Button>
                      {busy && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
                    </div>
                  </div>
                </div>
              </DashboardCard>
            );
          })}
        </div>
      )}

      <GalleryMediaPicker
        open={picker !== null}
        kind={picker?.mode === "poster" ? "photo" : picker?.kind ?? "photo"}
        title={
          picker?.mode === "poster"
            ? c("pickPoster")
            : picker?.kind === "video"
              ? c("pickVideo")
              : c("pickPhoto")
        }
        description={c("pickerHint")}
        emptyLabel={c("pickerEmpty")}
        cancelLabel={c("cancel")}
        selectLabel={c("select")}
        currentUrl={picker && picker.mode !== "add" ? picker.currentUrl : undefined}
        onClose={() => setPicker(null)}
        onSelect={async (url) => {
          if (!picker) return;
          if (picker.mode === "add") await addItem(picker.kind, url);
          else if (picker.mode === "media") {
            if (await patch(picker.id, { media_url: url })) toast.success(c("saved"));
          } else if (await patch(picker.id, { poster_url: url })) toast.success(c("saved"));
          setPicker(null);
        }}
      />
    </div>
  );
};

export default DashboardGallery;
