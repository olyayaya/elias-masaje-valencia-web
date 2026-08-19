import { useState, useEffect, useRef, useMemo, lazy, Suspense } from "react";
import {
  Upload, Trash2, Loader2, AlertTriangle, List, LayoutGrid,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatFileSize } from "@/lib/image-utils";
import { MAX_CONVERT_BYTES } from "@/lib/video-convert";
import {
  checkMediaUsage,
  checkMediaUsageBatch,
  deleteMediaFile,
  renameMediaFile,
  type MediaUsage,
} from "@/lib/media-usage";
import {
  countByKind, classifyUpload, UPLOAD_ACCEPT, kindOf,
  type MediaKind,
} from "@/lib/media-kind";
import {
  applyFilters, availableExtensions, DEFAULT_FILTERS,
  type LibraryFile, type MediaFilters, type OptState,
} from "@/lib/media-filters";
import { clearFilters, loadFilters, saveFilters } from "@/lib/media-filters-storage";
import { DEFAULT_VIEW, loadView, saveView, type GridSize, type LibraryView } from "@/lib/media-view-storage";
import { buildRenameName, sanitizeBaseInput, splitFileName } from "@/lib/rename-name";
import { useI18n } from "@/i18n/context";
import { toast } from "sonner";
import DashboardCard from "./DashboardCard";
import MediaFilterBar from "./MediaFilterBar";
import MediaThumb from "./media/MediaThumb";
import MediaActions from "./media/MediaActions";
import MediaGrid from "./media/MediaGrid";
import { makeL, toLang } from "./media/i18n";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { ProcessingItem } from "./MediaProcessingDialog";

// The ffmpeg engine lives behind this lazy boundary: opening the processing dialog is what
// pulls the wasm core, never a plain visit to the Library.
const MediaProcessingDialog = lazy(() => import("./MediaProcessingDialog"));

type DeleteTarget = {
  name: string;
  usages: MediaUsage[];
  historyReferences: number;
};

const MAX_UPLOAD_VIDEO = MAX_CONVERT_BYTES;

const DashboardMedia = () => {
  const { locale } = useI18n();
  const lang = toLang(locale);
  const L = useMemo(() => makeL(lang), [lang]);

  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [loading, setLoading] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  const [target, setTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  /** Files queued for the shared processing dialog — nothing is uploaded until Apply. */
  const [processing, setProcessing] = useState<ProcessingItem[] | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<LibraryFile | null>(null);
  /** Only the basename is editable — the extension is a fixed, read-only suffix. */
  const [renameBase, setRenameBase] = useState("");
  const [renameExt, setRenameExt] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  // Lazy initializers: the restored filters are the very first render, so the operator
  // never sees a flash of the unfiltered default list.
  const [filters, setFilters] = useState<MediaFilters>(() => loadFilters().filters);
  const [filtersOpen, setFiltersOpen] = useState(() => loadFilters().open);
  const [usage, setUsage] = useState<Record<string, number> | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [optimization, setOptimization] = useState<Record<string, OptState>>({});

  const [previewing, setPreviewing] = useState<LibraryFile | null>(null);

  // View preference (list vs. tiles + tile size), restored on first render.
  const [view, setView] = useState<LibraryView>(() => loadView().view);
  const [gridSize, setGridSize] = useState<GridSize>(() => loadView().size);
  useEffect(() => { saveView({ view, size: gridSize }); }, [view, gridSize]);

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

  // Persist every filter change (and the advanced panel state) until a manual Reset.
  useEffect(() => { saveFilters(filters, filtersOpen); }, [filters, filtersOpen]);

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

  /**
   * A restored used/unused filter would otherwise show a false "no files": run exactly one
   * batch scan once the listing is in, never repeating it.
   */
  const autoScanned = useRef(false);
  useEffect(() => {
    if (loading || autoScanned.current) return;
    if (usage !== null || usageLoading) return;
    if (filters.usage !== "used" && filters.usage !== "unused") return;
    if (!files.length) return;
    autoScanned.current = true;
    void scanUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, files, filters.usage]);

  const resetFilters = () => {
    clearFilters();
    setFilters(DEFAULT_FILTERS);
    setFiltersOpen(false);
  };

  const markOpt = (name: string, state: OptState) =>
    setOptimization((prev) => ({ ...prev, [name]: state }));

  // ---- upload → processing queue -----------------------------------------
  /**
   * Selecting or dropping files never touches storage: everything lands in the shared
   * processing dialog first, so the operator sees the result before it is uploaded.
   */
  const queueUploads = (fileList: FileList) => {
    const items: ProcessingItem[] = [];
    Array.from(fileList).forEach((file, i) => {
      const verdict = classifyUpload(file);
      if (!verdict.ok) {
        toast.error(L("skippedUnsupported", { f: file.name }));
        return;
      }
      if (verdict.kind === "video" && file.size > MAX_UPLOAD_VIDEO) {
        toast.error(L("tooBig", { f: file.name, m: Math.round(MAX_UPLOAD_VIDEO / (1024 * 1024)) }));
        return;
      }
      items.push({ id: `up-${Date.now()}-${i}-${file.name}`, file, kind: verdict.kind });
    });
    if (items.length) setProcessing(items);
  };

  /** Edit/Replace an existing object: download the original, then reuse the same dialog. */
  const openEditor = async (f: LibraryFile) => {
    const kind = kindOf(f);
    if (kind === "other") return;
    setOpening(f.name);
    try {
      const { data, error } = await supabase.storage.from("media").download(f.name);
      if (error || !data) throw new Error(error?.message || L("openFailed", { f: f.name }));
      const file = new File([data], f.name, { type: data.type || f.mimeType || "" });
      // Storage metadata can be stale or zero — the bytes we just downloaded are the truth.
      const actualSize = file.size || f.size;
      let publishedInGallery = false;
      try {
        const usageResult = await checkMediaUsage(f.name);
        publishedInGallery = (usageResult.usages ?? []).some((u) => /gallery|galer/i.test(u.entity));
      } catch {
        // The server guard is authoritative; a failed pre-check only loses a local hint.
      }
      setProcessing([{
        id: `edit-${Date.now()}-${f.name}`,
        file,
        kind,
        replace: { name: f.name, size: actualSize, publishedInGallery },
      }]);
    } catch (err) {
      toast.error((err as Error).message || L("openFailed", { f: f.name }));
    } finally {
      setOpening(null);
    }
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

  const openRename = (file: LibraryFile) => {
    const { base, ext } = splitFileName(file.name);
    setRenameTarget(file);
    setRenameBase(base);
    setRenameExt(ext);
    setRenameError(null);
  };

  const submitRename = async () => {
    if (!renameTarget) return;
    // The extension always comes from the original object, never from the input.
    const base = sanitizeBaseInput(renameBase, renameExt).trim();
    const next = buildRenameName(base, renameExt);
    if (!base) return setRenameError(L("errEmpty"));
    if (/[\\/]|\.\./.test(base)) return setRenameError(L("errPaths"));
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(next)) return setRenameError(L("errChars"));
    if (next === renameTarget.name) return setRenameError(L("errSame"));
    if (files.some((f) => f.name === next)) return setRenameError(L("errExists"));

    setRenaming(true);
    setRenameError(null);
    try {
      // media-guard re-validates the extension server-side (validateRenameExtension).
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

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" size={24} /></div>;

  const blocked = (target?.usages.length ?? 0) > 0;
  const iconBtn = "p-2 rounded-lg hover:bg-secondary disabled:opacity-50 shrink-0";
  const tabs: { id: "all" | MediaKind; label: string; count: number }[] = [
    { id: "all", label: L("all"), count: files.length },
    { id: "photo", label: L("photos"), count: counts.photo },
    { id: "video", label: L("videos"), count: counts.video },
    { id: "other", label: L("other"), count: counts.other },
  ];

  const actions = {
    onPreview: (f: LibraryFile) => setPreviewing(f),
    onEdit: (f: LibraryFile) => { void openEditor(f); },
    onRename: openRename,
    onDelete: (f: LibraryFile) => { void requestDelete(f.name); },
    opening,
    checking,
  };

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
            if (e.dataTransfer.files.length) queueUploads(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
        >
          <Upload size={24} className="mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            {L("dropHere")} <span className="text-foreground underline">{L("browse")}</span>
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">{L("formats")}</p>
          <p className="text-xs text-muted-foreground/70 mt-1">{L("processBeforeUpload")}</p>
          <input
            ref={inputRef}
            type="file"
            accept={UPLOAD_ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => { if (e.target.files) queueUploads(e.target.files); e.target.value = ""; }}
          />
        </div>
      </DashboardCard>

      <DashboardCard
        title={L("library")}
        description={L("showing", { n: filtered.length, t: files.length })}
      >
        <div className="space-y-4">
          <Tabs value={filters.kind} onValueChange={(v) => setFilters({ ...filters, kind: v as MediaFilters["kind"] })}>
            {/* Horizontally scrollable so all four tabs stay tappable on narrow phones. */}
            <TabsList className="w-full max-w-full justify-start overflow-x-auto flex-nowrap">
              {tabs.map((t) => (
                <TabsTrigger key={t.id} value={t.id} className="shrink-0">
                  {t.label}
                  <span className="ml-1.5 text-xs text-muted-foreground">{t.count}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <MediaFilterBar
            filters={filters}
            onChange={setFilters}
            onReset={resetFilters}
            extensions={extensions}
            L={L}
            open={filtersOpen}
            onToggle={() => setFiltersOpen((o) => !o)}
            usageLoaded={usage !== null}
            usageLoading={usageLoading}
            onScanUsage={() => void scanUsage()}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={view} onValueChange={(v) => setView(v as LibraryView)}>
              <TabsList aria-label={L("viewLabel")}>
                <TabsTrigger value="list" aria-label={L("viewList")} title={L("viewList")}>
                  <List size={14} className="mr-1" />{L("viewList")}
                </TabsTrigger>
                <TabsTrigger value="grid" aria-label={L("viewGrid")} title={L("viewGrid")}>
                  <LayoutGrid size={14} className="mr-1" />{L("viewGrid")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {view === "grid" && (
              <Tabs value={gridSize} onValueChange={(v) => setGridSize(v as GridSize)}>
                <TabsList aria-label={L("tileSize")}>
                  <TabsTrigger value="s" aria-label={L("sizeSmall")} title={L("sizeSmall")}>S</TabsTrigger>
                  <TabsTrigger value="m" aria-label={L("sizeMedium")} title={L("sizeMedium")}>M</TabsTrigger>
                  <TabsTrigger value="l" aria-label={L("sizeLarge")} title={L("sizeLarge")}>L</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{L("empty")}</p>
          ) : view === "grid" ? (
            <MediaGrid files={filtered} size={gridSize} usage={usage} L={L} {...actions} />
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((f) => {
                const refs = usage?.[f.name];
                return (
                  <div key={f.name} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                    <MediaThumb file={f} />
                    <div className="flex-1 min-w-[8rem]">
                      <p className="text-sm text-foreground truncate">{f.name}</p>
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(f.size)}
                        {refs !== undefined && (
                          <> · {refs > 0 ? L("used") : L("unused")}</>
                        )}
                      </span>
                    </div>
                    {kindOf(f) === "video" && <Badge variant="outline" className="shrink-0">{L("videos")}</Badge>}
                    <MediaActions file={f} L={L} {...actions} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DashboardCard>

      {processing && (
        <Suspense fallback={null}>
          <MediaProcessingDialog
            items={processing}
            L={L}
            existingNames={files.map((f) => f.name)}
            onClose={() => setProcessing(null)}
            onApplied={(name, replacedName) => {
              markOpt(name, "optimized");
              setUsage(null);
              // The dialog stays silent on success: this is the single notification.
              toast.success(replacedName ? L("replaced", { n: name }) : L("appliedOk", { n: name }));
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
              <div className="flex items-center gap-2">
                <Input
                  id="media-rename"
                  value={renameBase}
                  aria-describedby="media-rename-ext"
                  onChange={(e) => { setRenameBase(sanitizeBaseInput(e.target.value, renameExt)); setRenameError(null); }}
                  disabled={renaming}
                />
                <span
                  id="media-rename-ext"
                  data-testid="rename-ext"
                  aria-label={L("extLocked")}
                  title={L("extLocked")}
                  className="select-none text-sm text-muted-foreground bg-secondary border border-border rounded-md px-2 py-2 shrink-0"
                >
                  {renameExt}
                </span>
              </div>
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
export default DashboardMedia;
