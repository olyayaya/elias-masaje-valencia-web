import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus, Trash2, ChevronUp, ChevronDown, Loader2, Film, ImageIcon, Eye, EyeOff, AlertTriangle, Wand2, X,
} from "lucide-react";
import { useI18n } from "@/i18n/context";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import { galleryTable, publishIssues, type GalleryItem, type GalleryPublishIssue } from "@/lib/gallery";
import { listAllMediaNames } from "@/lib/storage-list";
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
  pickerSearch: { en: "Search by file name", es: "Buscar por nombre de archivo", ru: "Поиск по имени файла" },
  pickerNoMatch: { en: "No files match your search.", es: "Ningún archivo coincide con la búsqueda.", ru: "Нет файлов, подходящих под запрос." },
  pickerError: {
    en: "Could not load the Library files.",
    es: "No se pudieron cargar los archivos de la Biblioteca.",
    ru: "Не удалось загрузить файлы Библиотеки.",
  },
  retry: { en: "Retry", es: "Reintentar", ru: "Повторить" },
  cancel: { en: "Cancel", es: "Cancelar", ru: "Отмена" },
  select: { en: "Select", es: "Seleccionar", ru: "Выбрать" },
  changeMedia: { en: "Change file", es: "Cambiar archivo", ru: "Заменить файл" },
  poster: { en: "Video cover", es: "Portada del vídeo", ru: "Обложка видео" },
  generateCover: { en: "Generate cover", es: "Generar portada", ru: "Создать обложку" },
  generating: { en: "Generating cover…", es: "Generando portada…", ru: "Создание обложки…" },
  coverProgress: { en: "Generating cover — {p}%", es: "Generando portada — {p}%", ru: "Создание обложки — {p}%" },
  coverCancel: { en: "Cancel cover generation", es: "Cancelar la generación de portada", ru: "Отменить создание обложки" },
  coverCancelled: { en: "Cover generation cancelled", es: "Generación de portada cancelada", ru: "Создание обложки отменено" },
  coverDone: { en: "Cover generated", es: "Portada generada", ru: "Обложка создана" },
  coverFailed: {
    en: "Could not generate a cover from this video. Pick an image instead.",
    es: "No se pudo generar la portada de este vídeo. Elige una imagen.",
    ru: "Не удалось создать обложку из этого видео. Выберите изображение.",
  },
  posterCleared: {
    en: "Cover cleared because the video file changed — generate or pick a new one.",
    es: "Se ha borrado la portada porque cambió el vídeo — genera o elige una nueva.",
    ru: "Обложка сброшена, так как видео изменилось — создайте или выберите новую.",
  },
  reorderFailed: {
    en: "Could not reorder — the atomic reorder function is unavailable. Nothing was changed.",
    es: "No se pudo reordenar: la función de reordenación atómica no está disponible. No se cambió nada.",
    ru: "Не удалось изменить порядок: атомарная функция недоступна. Ничего не изменено.",
  },

  issueMissingMedia: { en: "No file selected.", es: "Ningún archivo seleccionado.", ru: "Файл не выбран." },
  issueMissingPoster: {
    en: "A video needs a cover image before it can be published.",
    es: "Un vídeo necesita una portada antes de publicarse.",
    ru: "Для публикации видео нужна обложка.",
  },
  issueNotWebPlayable: {
    en: "This format (MOV/M4V) does not play in every browser. Convert it to MP4 or WebM in the Library first.",
    es: "Este formato (MOV/M4V) no se reproduce en todos los navegadores. Conviértelo a MP4 o WebM en la Biblioteca.",
    ru: "Этот формат (MOV/M4V) воспроизводится не во всех браузерах. Сначала конвертируйте его в MP4 или WebM в Библиотеке.",
  },
  cannotPublish: { en: "Cannot publish yet", es: "Aún no se puede publicar", ru: "Пока нельзя опубликовать" },
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

const ISSUE_COPY: Record<GalleryPublishIssue, keyof typeof COPY> = {
  missingMedia: "issueMissingMedia",
  missingPoster: "issueMissingPoster",
  notWebPlayable: "issueNotWebPlayable",
};

const DashboardGallery = () => {
  const c = useCopy();
  const qc = useQueryClient();
  const { data: items = [], isPending, missingTable } = useGalleryAdmin();
  const [lang, setLang] = useState<Lang>("es");
  const [busyId, setBusyId] = useState<string | null>(null);
  /** Cover generation is a long, cancellable job: it owns its own visible progress. */
  const [poster, setPoster] = useState<{ id: string; progress: number } | null>(null);
  const [picker, setPicker] = useState<
    | null
    | { mode: "add"; kind: "photo" | "video" }
    | { mode: "media"; kind: "photo" | "video"; id: string; currentUrl: string }
    | { mode: "poster"; id: string; currentUrl: string }
  >(null);
  const [drafts, setDrafts] = useState<Record<string, Partial<GalleryItem>>>({});
  const posterAbort = useRef<AbortController | null>(null);

  // Leaving the section must not keep a wasm decode (or an upload) running.
  useEffect(() => () => posterAbort.current?.abort(), []);

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
      // `poster_url` only ever means "cover frame of a video". A photo is its own
      // image, so it never carries a poster — the grid derives its thumbnail itself.
      poster_url: "",
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

  /**
   * Reordering swaps two rows. Two independent UPDATEs can leave the list
   * half-swapped, so the swap ONLY ever happens inside the transactional RPC — if the
   * RPC is missing or fails, nothing is written at all and the admin sees why.
   */
  const move = async (item: GalleryItem, dir: -1 | 1) => {
    const idx = items.findIndex((i) => i.id === item.id);
    const other = items[idx + dir];
    if (!other) return;
    setBusyId(item.id);
    const rpc = (supabase as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { code?: string; message?: string } | null }>;
    }).rpc;
    const { error: rpcError } = await rpc("swap_gallery_order", { _a: item.id, _b: other.id });
    setBusyId(null);
    if (rpcError) {
      const missingRpc =
        rpcError.code === "PGRST202" || /could not find the function|does not exist/i.test(rpcError.message ?? "");
      toast.error(missingRpc ? c("reorderFailed") : c("saveFailed"));
      return;
    }
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

  /**
   * Best-effort removal of a derivative WE just created. Only the freshly uploaded
   * object name is ever passed here — the source video and any pre-existing cover are
   * untouched no matter how the generation ended. A failure is surfaced instead of
   * being silently swallowed, so the admin knows a stray file stayed in the Library.
   */
  const discardDerivative = async (name: string) => {
    try {
      const { error: rmErr } = await supabase.storage.from("media").remove([name]);
      if (rmErr) toast.warning(c("cleanupFailed", { name }));
    } catch {
      toast.warning(c("cleanupFailed", { name }));
    }
  };

  /** Extract a cover frame in the browser and store it next to the other media. */
  const generateCover = async (item: GalleryItem) => {
    if (!item.media_url) return;
    posterAbort.current?.abort();
    const controller = new AbortController();
    posterAbort.current = controller;
    setPoster({ id: item.id, progress: 0 });
    const bump = (p: number) =>
      setPoster((cur) => (cur && cur.id === item.id ? { ...cur, progress: p } : cur));
    let uploaded: string | null = null;
    try {
      // Lazy: neither the poster module nor the FFmpeg fallback is in any other bundle.
      const { generatePoster, posterNameFor } = await import("@/lib/gallery-poster");
      const result = await generatePoster({
        videoUrl: item.media_url,
        signal: controller.signal,
        onProgress: (r) => {
          if (!controller.signal.aborted) bump(Math.min(90, Math.round(r * 90)));
        },
      });
      if (controller.signal.aborted) return;

      // Full paginated listing: a truncated one could hand back a name already in use.
      const taken = await listAllMediaNames();
      // Cancelling during that listing must leave Storage completely untouched.
      if (controller.signal.aborted) return;
      const name = posterNameFor(item.media_url, result.ext, taken);
      bump(92);
      if (controller.signal.aborted) return;
      const { error: upErr } = await supabase.storage
        .from("media")
        .upload(name, result.blob, { contentType: result.mimeType, upsert: false });
      if (upErr) throw upErr;
      uploaded = name;
      bump(96);

      if (controller.signal.aborted) return;

      const url = supabase.storage.from("media").getPublicUrl(name).data.publicUrl;
      if (await patch(item.id, { poster_url: url })) {
        uploaded = null;
        bump(100);
        toast.success(c("coverDone"));
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        if (import.meta.env.DEV) console.error("[gallery poster]", e);
        toast.error(c("coverFailed"));
      }
    } finally {
      // Cancelled or failed after the upload: delete only that new derivative.
      if (uploaded) await discardDerivative(uploaded);
      if (controller.signal.aborted) toast.message(c("coverCancelled"));
      if (posterAbort.current === controller) posterAbort.current = null;
      setPoster((cur) => (cur && cur.id === item.id ? null : cur));
    }
  };

  const cancelCover = () => posterAbort.current?.abort();


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

  const togglePublished = async (item: GalleryItem) => {
    if (!item.published) {
      const issues = publishIssues(item);
      if (issues.length > 0) {
        toast.error(`${c("cannotPublish")}: ${issues.map((i) => c(ISSUE_COPY[i])).join(" ")}`);
        return;
      }
    }
    await patch(item.id, { published: !item.published });
  };

  if (missingTable) {
    return (
      <DashboardCard title="Gallery">
        <p className="text-sm text-muted-foreground flex items-start gap-2" data-testid="gallery-missing-table">
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
            const posterBusy = poster?.id === item.id;
            const posterProgress = poster?.id === item.id ? poster.progress : 0;

            const thumb = item.media_type === "video" ? item.poster_url : item.media_url;
            const issues = publishIssues(item);
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
                          disabled={posterBusy || !item.media_url}
                          onClick={() => generateCover(item)}
                        >
                          {posterBusy ? (
                            <Loader2 size={13} className="mr-1.5 animate-spin" />
                          ) : (
                            <Wand2 size={13} className="mr-1.5" />
                          )}
                          {posterBusy ? c("generating") : c("generateCover")}
                        </Button>
                        {posterBusy && (
                          <div className="space-y-1" data-testid="cover-progress">
                            <div
                              role="progressbar"
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={posterProgress}
                              aria-label={c("generating")}
                              className="h-1.5 w-full rounded-full bg-secondary overflow-hidden"
                            >
                              <div
                                className="h-full bg-primary transition-all"
                                style={{ width: `${posterProgress}%` }}
                              />
                            </div>
                            <p className="text-[11px] text-muted-foreground" aria-live="polite">
                              {c("coverProgress", { p: String(posterProgress) })}
                            </p>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="w-full text-destructive"
                              onClick={cancelCover}
                            >
                              <X size={13} className="mr-1.5" /> {c("coverCancel")}
                            </Button>
                          </div>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => setPicker({ mode: "poster", id: item.id, currentUrl: item.poster_url })}
                        >
                          <ImageIcon size={13} className="mr-1.5" /> {c("poster")}
                        </Button>
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

                    {!item.published && issues.length > 0 && (
                      <ul className="text-[11px] text-muted-foreground space-y-1" data-testid="publish-issues">
                        {issues.map((i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                            {c(ISSUE_COPY[i])}
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        variant={item.published ? "default" : "outline"}
                        disabled={busy || (!item.published && issues.length > 0)}
                        onClick={() => togglePublished(item)}
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
        searchPlaceholder={c("pickerSearch")}
        noMatchLabel={c("pickerNoMatch")}
        errorLabel={c("pickerError")}
        retryLabel={c("retry")}
        cancelLabel={c("cancel")}
        selectLabel={c("select")}
        currentUrl={picker && picker.mode !== "add" ? picker.currentUrl : undefined}
        onClose={() => setPicker(null)}
        onSelect={async (url) => {
          if (!picker) return;
          if (picker.mode === "add") await addItem(picker.kind, url);
          else if (picker.mode === "media") {
            const target = items.find((i) => i.id === picker.id);
            // A cover belongs to one specific video file: replacing the file must
            // never leave the previous video's frame (and a published video without
            // a cover is not allowed, so it is unpublished in the same write).
            // A photo never owns a cover, so its poster_url is explicitly cleared.
            const changed = !!target && target.media_url !== url;
            const clearPoster = changed && target?.media_type === "video";
            const values: Record<string, unknown> = { media_url: url };
            if (target?.media_type === "photo") values.poster_url = "";
            if (clearPoster) {
              values.poster_url = "";
              values.published = false;
            }

            if (await patch(picker.id, values)) {
              toast.success(c("saved"));
              if (clearPoster) toast.warning(c("posterCleared"));
            }
          } else if (await patch(picker.id, { poster_url: url })) toast.success(c("saved"));

          setPicker(null);
        }}
      />
    </div>
  );
};

export default DashboardGallery;
