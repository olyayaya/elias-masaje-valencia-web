import { useState, useEffect, useRef } from "react";
import { Upload, Trash2, Loader2, Copy, Check, AlertTriangle, Sparkles, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { optimizeImage, formatFileSize } from "@/lib/image-utils";
import {
  checkMediaUsage,
  deleteMediaFile,
  renameMediaFile,
  replaceMediaFile,
  MediaGuardError,
  type MediaUsage,
} from "@/lib/media-usage";
import { analyzeCompression, blobToBase64, type UnsupportedReason } from "@/lib/media-compress";
import { useI18n } from "@/i18n/context";
import { toast } from "sonner";
import DashboardCard from "./DashboardCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MediaFile {
  name: string;
  size: number;
  url: string;
  created_at: string;
}

type DeleteTarget = {
  name: string;
  usages: MediaUsage[];
  historyReferences: number;
};

type Lang = "en" | "es" | "ru";

const COPY = {
  dropHere: { en: "Drop images here or", es: "Suelta imágenes aquí o", ru: "Перетащите изображения сюда или" },
  browse: { en: "browse", es: "explora", ru: "выберите" },
  formats: { en: "JPG, PNG, WebP", es: "JPG, PNG, WebP", ru: "JPG, PNG, WebP" },
  uploading: { en: "Uploading…", es: "Subiendo…", ru: "Загрузка…" },
  uploaded: { en: "Optimized & uploaded (saved {n})", es: "Optimizada y subida (ahorro {n})", ru: "Оптимизировано и загружено (экономия {n})" },
  uploadFailed: { en: "Upload failed", es: "Error al subir", ru: "Ошибка загрузки" },
  library: { en: "Library", es: "Biblioteca", ru: "Библиотека" },
  files: { en: "{n} files", es: "{n} archivos", ru: "{n} файлов" },
  compress: { en: "Smart compress", es: "Compresión inteligente", ru: "Умное сжатие" },
  rename: { en: "Rename", es: "Renombrar", ru: "Переименовать" },
  copyUrl: { en: "Copy URL", es: "Copiar URL", ru: "Копировать ссылку" },
  del: { en: "Delete", es: "Eliminar", ru: "Удалить" },
  already: { en: "Image is already compressed — nothing was changed", es: "La imagen ya está comprimida: no se cambió nada", ru: "Изображение уже сжато — ничего не изменено" },
  compressed: { en: "Compressed: {a} → {b} (−{p}%)", es: "Comprimida: {a} → {b} (−{p}%)", ru: "Сжато: {a} → {b} (−{p}%)" },
  linksUpdated: { en: "{n} link(s) updated", es: "{n} enlace(s) actualizados", ru: "обновлено ссылок: {n}" },
  compressFailed: { en: "Compression failed", es: "Error al comprimir", ru: "Ошибка сжатия" },
  cannotCompress: { en: "Cannot compress {f} — {r}", es: "No se puede comprimir {f} — {r}", ru: "Нельзя сжать {f} — {r}" },
  renamedTo: { en: "Renamed to {n}", es: "Renombrada a {n}", ru: "Переименовано в {n}" },
  renameFailed: { en: "Rename failed", es: "Error al renombrar", ru: "Ошибка переименования" },
  renameTitle: { en: "Rename file", es: "Renombrar archivo", ru: "Переименовать файл" },
  renameDesc: {
    en: "All links to this image in your content are updated in a single transaction, and old versions in the change history keep resolving to the new name.",
    es: "Todos los enlaces a esta imagen se actualizan en una sola transacción, y las versiones antiguas del historial siguen apuntando al nuevo nombre.",
    ru: "Все ссылки на это изображение обновляются одной транзакцией, а старые версии в истории продолжают указывать на новое имя.",
  },
  currentName: { en: "Current name", es: "Nombre actual", ru: "Текущее имя" },
  newName: { en: "New name", es: "Nombre nuevo", ru: "Новое имя" },
  cancel: { en: "Cancel", es: "Cancelar", ru: "Отмена" },
  close: { en: "Close", es: "Cerrar", ru: "Закрыть" },
  errEmpty: { en: "Name cannot be empty", es: "El nombre no puede estar vacío", ru: "Имя не может быть пустым" },
  errPaths: { en: "Name cannot contain paths", es: "El nombre no puede contener rutas", ru: "Имя не может содержать пути" },
  errChars: { en: "Use letters, numbers, dot, dash and underscore only", es: "Usa solo letras, números, punto, guion y guion bajo", ru: "Только буквы, цифры, точка, дефис и подчёркивание" },
  errExt: { en: "Keep the {e} extension — change format via smart compression", es: "Mantén la extensión {e}: cambia el formato con la compresión inteligente", ru: "Сохраните расширение {e} — формат меняется через умное сжатие" },
  errSame: { en: "New name is identical", es: "El nombre nuevo es idéntico", ru: "Новое имя совпадает с текущим" },
  errExists: { en: "A file with that name already exists", es: "Ya existe un archivo con ese nombre", ru: "Файл с таким именем уже существует" },
  checkFailed: { en: "Couldn't verify where this file is used", es: "No se pudo comprobar dónde se usa este archivo", ru: "Не удалось проверить, где используется файл" },
  deleted: { en: "Deleted {n}", es: "Eliminada {n}", ru: "Удалено: {n}" },
  deleteFailed: { en: "Delete failed", es: "Error al eliminar", ru: "Ошибка удаления" },
  nowInUse: { en: "File is now in use — deletion blocked", es: "El archivo está en uso: eliminación bloqueada", ru: "Файл используется — удаление заблокировано" },
  inUseTitle: { en: "This file is still in use", es: "Este archivo sigue en uso", ru: "Файл всё ещё используется" },
  deleteTitle: { en: "Delete {n}?", es: "¿Eliminar {n}?", ru: "Удалить {n}?" },
  inUseBody: {
    en: "“{n}” is referenced by {c} item(s). Replace the image there first — deletion is blocked to avoid breaking published content.",
    es: "«{n}» está referenciada por {c} elemento(s). Cámbiala allí primero: la eliminación está bloqueada para no romper el contenido publicado.",
    ru: "«{n}» используется в {c} элемент(ах). Сначала замените изображение там — удаление заблокировано, чтобы не сломать опубликованный контент.",
  },
  deleteBody: {
    en: "No content references this file. Deleting it is permanent and cannot be undone.",
    es: "Ningún contenido usa este archivo. La eliminación es permanente y no se puede deshacer.",
    ru: "Ни один контент не ссылается на этот файл. Удаление необратимо.",
  },
  deletePermanently: { en: "Delete permanently", es: "Eliminar definitivamente", ru: "Удалить навсегда" },
  historyNote: {
    en: "Heads-up: {n} archived version(s) in the change history still reference this file. Restoring one of those after deletion would show a broken image. Live content is not affected.",
    es: "Aviso: {n} versión(es) archivadas del historial aún usan este archivo. Restaurar una de ellas tras la eliminación mostraría una imagen rota. El contenido publicado no se ve afectado.",
    ru: "Внимание: {n} архивных версий в истории ещё ссылаются на этот файл. Восстановление такой версии после удаления покажет битую картинку. На опубликованный контент это не влияет.",
  },
  aliasNote: {
    en: "{n} archived version(s) referenced the old name — they now resolve to the new one automatically on restore.",
    es: "{n} versión(es) archivadas usaban el nombre anterior: ahora se resuelven automáticamente al nuevo al restaurar.",
    ru: "{n} архивных версий ссылались на старое имя — при восстановлении они автоматически указывают на новое.",
  },
  leftover: {
    en: "Links updated, but the old file could not be removed: {m}",
    es: "Enlaces actualizados, pero no se pudo eliminar el archivo antiguo: {m}",
    ru: "Ссылки обновлены, но старый файл не удалось удалить: {m}",
  },
} as const;

const REASONS: Record<UnsupportedReason, Record<Lang, string>> = {
  gif: {
    en: "GIF animation cannot be re-encoded without losing the animation",
    es: "una animación GIF no se puede recomprimir sin perder la animación",
    ru: "GIF-анимацию нельзя пережать без потери анимации",
  },
  svg: {
    en: "SVG is a vector format and does not need raster compression",
    es: "SVG es vectorial y no necesita compresión de mapa de bits",
    ru: "SVG — векторный формат, растровое сжатие не требуется",
  },
  avif: {
    en: "AVIF is already a modern compressed format",
    es: "AVIF ya es un formato comprimido moderno",
    ru: "AVIF уже современный сжатый формат",
  },
  notImage: { en: "this file is not an image", es: "este archivo no es una imagen", ru: "это не изображение" },
  decode: {
    en: "this image could not be decoded in the browser",
    es: "esta imagen no se pudo decodificar en el navegador",
    ru: "изображение не удалось декодировать в браузере",
  },
  tooLarge: {
    en: "the re-encoded image exceeds the upload limit",
    es: "la imagen recomprimida supera el límite de subida",
    ru: "пережатое изображение превышает лимит загрузки",
  },
};

const fill = (s: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(String(v)), s);

const DashboardMedia = () => {
  const { locale } = useI18n();
  const lang = (["en", "es", "ru"] as const).includes(locale as Lang) ? (locale as Lang) : "en";
  const L = (k: keyof typeof COPY, vars: Record<string, string | number> = {}) =>
    fill(COPY[k][lang] ?? COPY[k].en, vars);

  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  const [target, setTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [compressing, setCompressing] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<MediaFile | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const fetchFiles = async () => {
    const { data } = await supabase.storage.from("media").list("", {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" },
    });
    if (data) {
      const mapped = data
        .filter((f) => f.name !== ".emptyFolderPlaceholder")
        .map((f) => ({
          name: f.name,
          size: f.metadata?.size || 0,
          url: supabase.storage.from("media").getPublicUrl(f.name).data.publicUrl,
          created_at: f.created_at || "",
        }));
      setFiles(mapped);
    }
    setLoading(false);
  };

  useEffect(() => { fetchFiles(); }, []);

  const handleUpload = async (fileList: FileList) => {
    setUploading(true);
    for (const file of Array.from(fileList)) {
      if (!file.type.startsWith("image/")) continue;
      try {
        const optimized = await optimizeImage(file);
        const name = `${Date.now()}-${file.name.replace(/\.[^.]+$/, "")}.${optimized.ext}`;
        await supabase.storage.from("media").upload(name, optimized.blob, {
          contentType: optimized.mime,
          cacheControl: "3600",
          upsert: false,
        });
        toast.success(L("uploaded", { n: formatFileSize(optimized.originalSize - optimized.optimizedSize) }));
      } catch (err: any) {
        toast.error(err.message || L("uploadFailed"));
      }
    }
    setUploading(false);
    fetchFiles();
  };

  /** Reports the server outcome honestly: warning stays a warning, never a plain success. */
  const reportOutcome = (message: string, result: { updatedReferences?: number; historyReferences?: number; aliased?: boolean; warning?: string }) => {
    const parts = [message];
    if (result.updatedReferences) parts.push(L("linksUpdated", { n: result.updatedReferences }));
    if (result.aliased && result.historyReferences) parts.push(L("aliasNote", { n: result.historyReferences }));
    const text = parts.join(" · ");
    if (result.warning) toast.warning(`${text} — ${L("leftover", { m: result.warning })}`);
    else toast.success(text);
  };

  const handleCompress = async (file: MediaFile) => {
    setCompressing(file.name);
    try {
      const outcome = await analyzeCompression(file.url, file.name);
      if (outcome.status === "unsupported") {
        toast.error(L("cannotCompress", { f: file.name, r: REASONS[outcome.reason][lang] ?? REASONS[outcome.reason].en }));
        return;
      }
      if (outcome.status === "already") {
        toast.success(L("already"));
        return;
      }
      const result = await replaceMediaFile({
        fileName: file.name,
        newName: outcome.newName,
        contentBase64: await blobToBase64(outcome.blob),
        contentType: outcome.contentType,
        originalSize: outcome.originalSize,
      });
      reportOutcome(
        L("compressed", {
          a: formatFileSize(outcome.originalSize),
          b: formatFileSize(result.newSize ?? outcome.newSize),
          p: outcome.savedPercent,
        }),
        result,
      );
      await fetchFiles();
    } catch (err: any) {
      // The server re-applies the threshold against the real stored size — respect its verdict.
      if (err instanceof MediaGuardError && err.alreadyCompressed) toast.success(L("already"));
      else toast.error(err.message || L("compressFailed"));
    } finally {
      setCompressing(null);
    }
  };

  const openRename = (file: MediaFile) => {
    setRenameTarget(file);
    setRenameValue(file.name);
    setRenameError(null);
  };

  const submitRename = async () => {
    if (!renameTarget) return;
    const next = renameValue.trim();
    const currentExt = renameTarget.name.match(/\.[^.]+$/)?.[0] ?? "";
    if (!next) return setRenameError(L("errEmpty"));
    if (/[\\/]|\.\./.test(next)) return setRenameError(L("errPaths"));
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(next)) return setRenameError(L("errChars"));
    if (!next.toLowerCase().endsWith(currentExt.toLowerCase())) return setRenameError(L("errExt", { e: currentExt }));
    if (next === renameTarget.name) return setRenameError(L("errSame"));
    if (files.some((f) => f.name === next)) return setRenameError(L("errExists"));

    setRenaming(true);
    setRenameError(null);
    try {
      const result = await renameMediaFile(renameTarget.name, next);
      reportOutcome(L("renamedTo", { n: next }), result);
      setRenameTarget(null);
      await fetchFiles();
    } catch (err: any) {
      setRenameError(err.message || L("renameFailed"));
    } finally {
      setRenaming(false);
    }
  };

  const requestDelete = async (name: string) => {
    setChecking(name);
    try {
      const result = await checkMediaUsage(name);
      setTarget({ name, usages: result.usages ?? [], historyReferences: result.historyReferences ?? 0 });
    } catch (err: any) {
      toast.error(err.message || L("checkFailed"));
    } finally {
      setChecking(null);
    }
  };

  const confirmDelete = async () => {
    if (!target || target.usages.length > 0) return;
    setDeleting(true);
    try {
      const result = await deleteMediaFile(target.name);
      if (result.deleted) {
        toast.success(L("deleted", { n: target.name }));
        setTarget(null);
        fetchFiles();
      } else {
        // Became used between check and delete
        setTarget({ name: target.name, usages: result.usages ?? [], historyReferences: result.historyReferences ?? 0 });
        toast.error(L("nowInUse"));
      }
    } catch (err: any) {
      toast.error(err.message || L("deleteFailed"));
    } finally {
      setDeleting(false);
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" size={24} /></div>;

  const blocked = (target?.usages.length ?? 0) > 0;
  const iconBtn = "p-2 rounded-lg hover:bg-secondary disabled:opacity-50 shrink-0";

  return (
    <div className="space-y-6">
      <DashboardCard>
        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
            dragging ? "border-muted-foreground bg-secondary" : "border-border hover:border-muted-foreground/40"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 size={24} className="mx-auto text-muted-foreground mb-3 animate-spin" />
          ) : (
            <Upload size={24} className="mx-auto text-muted-foreground/50 mb-3" />
          )}
          <p className="text-sm text-muted-foreground">
            {uploading ? L("uploading") : <>{L("dropHere")} <span className="text-foreground underline">{L("browse")}</span></>}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">{L("formats")}</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleUpload(e.target.files)}
          />
        </div>
      </DashboardCard>

      <DashboardCard title={L("library")} description={L("files", { n: files.length })}>
        <div className="divide-y divide-border">
          {files.map((f) => (
            <div key={f.name} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center overflow-hidden shrink-0">
                <img src={f.url} alt={f.name} className="w-10 h-10 rounded-lg object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
              <div className="flex-1 min-w-[8rem]">
                <p className="text-sm text-foreground truncate">{f.name}</p>
                <span className="text-xs text-muted-foreground">{formatFileSize(f.size)}</span>
              </div>
              <div className="flex items-center gap-1 ml-auto">
                <button
                  onClick={() => void handleCompress(f)}
                  disabled={compressing === f.name}
                  aria-label={`${L("compress")} ${f.name}`}
                  title={L("compress")}
                  className={`${iconBtn} text-muted-foreground hover:text-foreground`}
                >
                  {compressing === f.name ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                </button>
                <button
                  onClick={() => openRename(f)}
                  aria-label={`${L("rename")} ${f.name}`}
                  title={L("rename")}
                  className={`${iconBtn} text-muted-foreground hover:text-foreground`}
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => copyUrl(f.url)}
                  aria-label={`${L("copyUrl")} ${f.name}`}
                  title={L("copyUrl")}
                  className={`${iconBtn} text-muted-foreground hover:text-foreground`}
                >
                  {copied === f.url ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                </button>
                <button
                  onClick={() => void requestDelete(f.name)}
                  disabled={checking === f.name}
                  aria-label={`${L("del")} ${f.name}`}
                  title={L("del")}
                  className={`${iconBtn} text-muted-foreground hover:text-destructive`}
                >
                  {checking === f.name ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </DashboardCard>

      <Dialog open={!!renameTarget} onOpenChange={(open) => { if (!open && !renaming) setRenameTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{L("renameTitle")}</DialogTitle>
            <DialogDescription>{L("renameDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">{L("currentName")}</p>
              <p className="text-sm break-all">{renameTarget?.name}</p>
            </div>
            <div>
              <label htmlFor="media-rename" className="text-xs text-muted-foreground mb-1 block">{L("newName")}</label>
              <Input
                id="media-rename"
                value={renameValue}
                onChange={(e) => { setRenameValue(e.target.value); setRenameError(null); }}
                disabled={renaming}
              />
            </div>
            {renameError && <p className="text-xs text-destructive">{renameError}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setRenameTarget(null)} disabled={renaming}>{L("cancel")}</Button>
            <Button size="sm" onClick={() => void submitRename()} disabled={renaming}>
              {renaming ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              {L("rename")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!target} onOpenChange={(open) => { if (!open && !deleting) setTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {blocked ? L("inUseTitle") : L("deleteTitle", { n: target?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {blocked
                ? L("inUseBody", { n: target?.name ?? "", c: target?.usages.length ?? 0 })
                : L("deleteBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {!blocked && (target?.historyReferences ?? 0) > 0 && (
            <p className="text-xs text-muted-foreground border border-border rounded-lg p-3">
              {L("historyNote", { n: target?.historyReferences ?? 0 })}
            </p>
          )}

          {blocked && (
            <div className="max-h-64 overflow-auto space-y-2 text-xs border border-border rounded-lg p-3">
              {target?.usages.map((u, i) => (
                <div key={`${u.id}-${u.field}-${i}`} className="flex items-start gap-2">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0 text-destructive" />
                  <span className="text-foreground">
                    <strong>{u.entity}</strong> · {u.label}{" "}
                    <span className="text-muted-foreground">({u.field} · {u.id.slice(0, 8)})</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{blocked ? L("close") : L("cancel")}</AlertDialogCancel>
            {!blocked && (
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); void confirmDelete(); }}
                disabled={deleting}
              >
                {deleting ? <Loader2 size={14} className="animate-spin mr-1" /> : <Trash2 size={14} className="mr-1" />}
                {L("deletePermanently")}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DashboardMedia;
