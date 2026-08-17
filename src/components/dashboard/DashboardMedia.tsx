import { useState, useEffect, useRef, useMemo, lazy, Suspense } from "react";
import {
  Upload, Trash2, Loader2, Copy, Check, AlertTriangle, Sparkles, Pencil, Film, FileQuestion, Play, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { optimizeImage, formatFileSize } from "@/lib/image-utils";
import {
  checkMediaUsage,
  checkMediaUsageBatch,
  deleteMediaFile,
  renameMediaFile,
  replaceMediaFile,
  MediaGuardError,
  type MediaUsage,
} from "@/lib/media-usage";
import { analyzeCompression, blobToBase64 } from "@/lib/media-compress";
import {
  collisionSafeName, kindOf, countByKind, isVideoFile, UPLOAD_ACCEPT, VIDEO_MIME_BY_EXT, extOf,
  type MediaKind,
} from "@/lib/media-kind";
import {
  applyFilters, availableExtensions, DEFAULT_FILTERS,
  type LibraryFile, type MediaFilters, type OptState,
} from "@/lib/media-filters";
import { MAX_CONVERT_BYTES } from "@/lib/video-convert";
import { uploadResumable } from "@/lib/video-upload";
import { useI18n } from "@/i18n/context";
import { toast } from "sonner";
import DashboardCard from "./DashboardCard";
import MediaFilterBar from "./MediaFilterBar";
import { COPY, makeL, REASONS, toLang } from "./media/i18n";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import type { ConverterFile } from "./VideoConverterDialog";

// The ffmpeg engine lives behind this lazy boundary: opening the converter is what pulls
// the wasm core, never a plain visit to the Library.
const VideoConverterDialog = lazy(() => import("./VideoConverterDialog"));

type DeleteTarget = {
  name: string;
  usages: MediaUsage[];
  historyReferences: number;
};

const PAGE = 24;
const MAX_UPLOAD_VIDEO = MAX_CONVERT_BYTES;

const DashboardMedia = () => {
  const { locale } = useI18n();
  const lang = toLang(locale);
  const L = useMemo(() => makeL(lang), [lang]);

  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState(0);
  const uploadAbort = useRef<AbortController | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  const [target, setTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [compressing, setCompressing] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<LibraryFile | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const [filters, setFilters] = useState<MediaFilters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visible, setVisible] = useState(PAGE);
  const [usage, setUsage] = useState<Record<string, number> | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [optimization, setOptimization] = useState<Record<string, OptState>>({});

  const [converter, setConverter] = useState<ConverterFile | null>(null);
  const [previewing, setPreviewing] = useState<LibraryFile | null>(null);

  /** Lists the whole bucket (Storage caps a page at 1000 objects). */
  const fetchFiles = async () => {
    const all: LibraryFile[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.storage.from("media").list("", {
        limit: 1000,
        offset,
        sortBy: { column: "created_at", order: "desc" },
      });
      if (error || !data) break;
      for (const f of data) {
        if (f.name === ".emptyFolderPlaceholder") continue;
        all.push({
          name: f.name,
          size: (f.metadata?.size as number) || 0,
          url: supabase.storage.from("media").getPublicUrl(f.name).data.publicUrl,
          created_at: f.created_at || "",
          mimeType: (f.metadata?.mimetype as string) ?? null,
        });
      }
      if (data.length < 1000) break;
    }
    setFiles(all);
    setLoading(false);
  };

  useEffect(() => { void fetchFiles(); }, []);

  const counts = useMemo(() => countByKind(files), [files]);
  const extensions = useMemo(() => availableExtensions(files), [files]);
  const filtered = useMemo(
    () => applyFilters(files, filters, { usage, optimization }),
    [files, filters, usage, optimization],
  );
  const shown = filtered.slice(0, visible);

  useEffect(() => { setVisible(PAGE); }, [filters]);

  const scanUsage = async () => {
    setUsageLoading(true);
    try {
      const res = await checkMediaUsageBatch(files.map((f) => f.name));
      setUsage(res.usage ?? {});
    } catch (err) {
      toast.error((err as Error).message || L("usageFailed"));
    } finally {
      setUsageLoading(false);
    }
  };

  const markOpt = (name: string, state: OptState) =>
    setOptimization((prev) => ({ ...prev, [name]: state }));

  // ---- upload ------------------------------------------------------------
  const uploadPhoto = async (file: File) => {
    const optimized = await optimizeImage(file);
    const name = collisionSafeName(
      `${file.name.replace(/\.[^.]+$/, "")}.${optimized.ext}`,
      files.map((f) => f.name),
    );
    const { error } = await supabase.storage.from("media").upload(name, optimized.blob, {
      contentType: optimized.mime,
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw new Error(error.message);
    markOpt(name, "optimized");
    toast.success(L("uploaded", { n: formatFileSize(optimized.originalSize - optimized.optimizedSize) }));
  };

  const uploadVideo = async (file: File, contentType: string) => {
    const name = collisionSafeName(file.name, files.map((f) => f.name));
    const controller = new AbortController();
    uploadAbort.current = controller;
    setUploadPct(0);
    await uploadResumable(name, file, contentType, {
      signal: controller.signal,
      onProgress: (sent, total) => setUploadPct(total ? Math.round((sent / total) * 100) : 0),
    });
    // A freshly uploaded source has never been analyzed by the converter.
    markOpt(name, "unknown");
    toast.success(L("uploadedVideo", { n: name }));
  };

  const handleUpload = async (fileList: FileList) => {
    setUploading(true);
    for (const file of Array.from(fileList)) {
      // Extension-driven allowlist: only JPG/PNG/WebP… and MP4/MOV/M4V/WebM get through.
      const verdict = classifyUpload(file);
      setUploadLabel(file.name);
      setUploadPct(0);
      try {
        if (!verdict.ok) {
          toast.error(L("skippedUnsupported", { f: file.name }));
          continue;
        }
        if (verdict.kind === "photo") {
          await uploadPhoto(file);
        } else {
          if (file.size > MAX_UPLOAD_VIDEO) {
            toast.error(L("tooBig", { f: file.name, m: Math.round(MAX_UPLOAD_VIDEO / (1024 * 1024)) }));
            continue;
          }
          await uploadVideo(file, verdict.mimeType);
        }
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") toast.info(L("uploadCancelled"));
        else toast.error((err as Error).message || L("uploadFailed"));
      } finally {
        uploadAbort.current = null;
      }
    }
    setUploading(false);
    setUploadLabel(null);
    await fetchFiles();
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

  const handleCompress = async (file: LibraryFile) => {
    setCompressing(file.name);
    try {
      const outcome = await analyzeCompression(file.url, file.name);
      if (outcome.status === "unsupported") {
        markOpt(file.name, "unsupported");
        toast.error(L("cannotCompress", { f: file.name, r: REASONS[outcome.reason][lang] ?? REASONS[outcome.reason].en }));
        return;
      }
      if (outcome.status === "already") {
        markOpt(file.name, "optimized");
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
      markOpt(result.newName ?? outcome.newName, "optimized");
      reportOutcome(
        L("compressed", {
          a: formatFileSize(outcome.originalSize),
          b: formatFileSize(result.newSize ?? outcome.newSize),
          p: outcome.savedPercent,
        }),
        result,
      );
      await fetchFiles();
    } catch (err) {
      // The server re-applies the threshold against the real stored size — respect its verdict.
      if (err instanceof MediaGuardError && err.alreadyCompressed) {
        markOpt(file.name, "optimized");
        toast.success(L("already"));
      } else {
        toast.error((err as Error).message || L("compressFailed"));
      }
    } finally {
      setCompressing(null);
    }
  };

  const openRename = (file: LibraryFile) => {
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
      setUsage(null);
      await fetchFiles();
    } catch (err) {
      setRenameError((err as Error).message || L("renameFailed"));
    } finally {
      setRenaming(false);
    }
  };

  const requestDelete = async (name: string) => {
    setChecking(name);
    try {
      const result = await checkMediaUsage(name);
      setTarget({ name, usages: result.usages ?? [], historyReferences: result.historyReferences ?? 0 });
    } catch (err) {
      toast.error((err as Error).message || L("checkFailed"));
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
        setUsage(null);
        await fetchFiles();
      } else {
        // Became used between check and delete
        setTarget({ name: target.name, usages: result.usages ?? [], historyReferences: result.historyReferences ?? 0 });
        toast.error(L("nowInUse"));
      }
    } catch (err) {
      toast.error((err as Error).message || L("deleteFailed"));
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
  const tabs: { id: "all" | MediaKind; label: string; count: number }[] = [
    { id: "all", label: L("all"), count: files.length },
    { id: "photo", label: L("photos"), count: counts.photo },
    { id: "video", label: L("videos"), count: counts.video },
    { id: "other", label: L("other"), count: counts.other },
  ];

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
            if (e.dataTransfer.files.length) void handleUpload(e.dataTransfer.files);
          }}
          onClick={() => { if (!uploading) inputRef.current?.click(); }}
        >
          {uploading ? (
            <Loader2 size={24} className="mx-auto text-muted-foreground mb-3 animate-spin" />
          ) : (
            <Upload size={24} className="mx-auto text-muted-foreground/50 mb-3" />
          )}
          <p className="text-sm text-muted-foreground">
            {uploading
              ? (uploadLabel ? L("uploadingFile", { f: uploadLabel, p: uploadPct }) : L("uploading"))
              : <>{L("dropHere")} <span className="text-foreground underline">{L("browse")}</span></>}
          </p>
          {uploading && uploadAbort.current && (
            <div className="max-w-sm mx-auto mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
              <Progress value={uploadPct} />
              <Button variant="ghost" size="sm" onClick={() => uploadAbort.current?.abort()}>
                <X size={14} className="mr-1" />{L("cancel")}
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground/70 mt-1">{L("formats")}</p>
          <input
            ref={inputRef}
            type="file"
            accept={UPLOAD_ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => { if (e.target.files) void handleUpload(e.target.files); e.target.value = ""; }}
          />
        </div>
      </DashboardCard>

      <DashboardCard
        title={L("library")}
        description={L("showing", { n: shown.length, t: filtered.length })}
      >
        <div className="space-y-4">
          <Tabs value={filters.kind} onValueChange={(v) => setFilters({ ...filters, kind: v as MediaFilters["kind"] })}>
            <TabsList>
              {tabs.map((t) => (
                <TabsTrigger key={t.id} value={t.id}>
                  {t.label}
                  <span className="ml-1.5 text-xs text-muted-foreground">{t.count}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <MediaFilterBar
            filters={filters}
            onChange={setFilters}
            extensions={extensions}
            L={L}
            open={filtersOpen}
            onToggle={() => setFiltersOpen((o) => !o)}
            usageLoaded={usage !== null}
            usageLoading={usageLoading}
            onScanUsage={() => void scanUsage()}
          />

          {shown.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{L("empty")}</p>
          ) : (
            <div className="divide-y divide-border">
              {shown.map((f) => {
                const kind = kindOf(f);
                const refs = usage?.[f.name];
                return (
                  <div key={f.name} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center overflow-hidden shrink-0">
                      {kind === "photo" ? (
                        <img
                          src={f.url}
                          alt={f.name}
                          loading="lazy"
                          className="w-10 h-10 rounded-lg object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : kind === "video" ? (
                        <Film size={16} className="text-muted-foreground" aria-hidden="true" />
                      ) : (
                        <FileQuestion size={16} className="text-muted-foreground" aria-hidden="true" />
                      )}
                    </div>
                    <div className="flex-1 min-w-[8rem]">
                      <p className="text-sm text-foreground truncate">{f.name}</p>
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(f.size)}
                        {refs !== undefined && (
                          <> · {refs > 0 ? L("used") : L("unused")}</>
                        )}
                      </span>
                    </div>
                    {kind === "video" && <Badge variant="outline" className="shrink-0">{L("videos")}</Badge>}
                    <div className="flex items-center gap-1 ml-auto">
                      {kind === "photo" && (
                        <button
                          onClick={() => void handleCompress(f)}
                          disabled={compressing === f.name}
                          aria-label={`${L("compress")} ${f.name}`}
                          title={L("compress")}
                          className={`${iconBtn} text-muted-foreground hover:text-foreground`}
                        >
                          {compressing === f.name ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        </button>
                      )}
                      {kind === "video" && (
                        <>
                          <button
                            onClick={() => setPreviewing(f)}
                            aria-label={`${L("preview")} ${f.name}`}
                            title={L("preview")}
                            className={`${iconBtn} text-muted-foreground hover:text-foreground`}
                          >
                            <Play size={14} />
                          </button>
                          <button
                            onClick={() => setConverter({ name: f.name, url: f.url, size: f.size })}
                            aria-label={`${L("convert")} ${f.name}`}
                            title={L("convert")}
                            className={`${iconBtn} text-muted-foreground hover:text-foreground`}
                          >
                            <Sparkles size={14} />
                          </button>
                        </>
                      )}
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
                );
              })}
            </div>
          )}

          {filtered.length > shown.length && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" onClick={() => setVisible((v) => v + PAGE)}>
                {L("loadMore")}
              </Button>
            </div>
          )}
        </div>
      </DashboardCard>

      {converter && (
        <Suspense fallback={null}>
          <VideoConverterDialog
            file={converter}
            L={L}
            onClose={() => setConverter(null)}
            onReplaced={(result, newName) => {
              setConverter(null);
              setUsage(null);
              reportOutcome(L("replaced", { n: newName }), result);
              void fetchFiles();
            }}
          />
        </Suspense>
      )}

      <Dialog open={!!previewing} onOpenChange={(open) => { if (!open) setPreviewing(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="break-all">{previewing?.name}</DialogTitle>
            <DialogDescription>{formatFileSize(previewing?.size ?? 0)}</DialogDescription>
          </DialogHeader>
          {previewing && (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={previewing.url} controls playsInline className="w-full rounded-lg bg-black" />
          )}
        </DialogContent>
      </Dialog>

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

export type { LibraryFile };
export { COPY };
export default DashboardMedia;
