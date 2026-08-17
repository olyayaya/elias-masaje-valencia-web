import { useState, useEffect, useRef } from "react";
import { Upload, Trash2, Loader2, Copy, Check, AlertTriangle, Sparkles, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { optimizeImage, getOptimizedExtension, formatFileSize } from "@/lib/image-utils";
import {
  checkMediaUsage,
  deleteMediaFile,
  renameMediaFile,
  replaceMediaFile,
  type MediaUsage,
} from "@/lib/media-usage";
import { analyzeCompression, blobToBase64 } from "@/lib/media-compress";
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

const DashboardMedia = () => {
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
        const ext = getOptimizedExtension();
        const name = `${Date.now()}-${file.name.replace(/\.[^.]+$/, "")}.${ext}`;
        await supabase.storage.from("media").upload(name, optimized.blob, {
          contentType: optimized.blob.type,
          cacheControl: "3600",
          upsert: false,
        });
        const saved = formatFileSize(optimized.originalSize - optimized.optimizedSize);
        toast.success(`Optimized & uploaded (saved ${saved})`);
      } catch (err: any) {
        toast.error(err.message || "Upload failed");
      }
    }
    setUploading(false);
    fetchFiles();
  };

  const handleCompress = async (file: MediaFile) => {
    setCompressing(file.name);
    try {
      const outcome = await analyzeCompression(file.url, file.name);
      if (outcome.status === "unsupported") {
        toast.error(`Cannot compress ${file.name} — ${outcome.reason}`);
        return;
      }
      if (outcome.status === "already") {
        toast.success("Image is already compressed — nothing was changed");
        return;
      }
      const result = await replaceMediaFile({
        fileName: file.name,
        newName: outcome.newName,
        contentBase64: await blobToBase64(outcome.blob),
        contentType: outcome.blob.type,
        originalSize: outcome.originalSize,
      });
      toast.success(
        `Compressed: ${formatFileSize(outcome.originalSize)} → ${formatFileSize(outcome.newSize)} (−${outcome.savedPercent}%)` +
          (result.updatedReferences ? ` · ${result.updatedReferences} link(s) updated` : "")
      );
      await fetchFiles();
    } catch (err: any) {
      toast.error(err.message || "Compression failed");
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
    if (!next) return setRenameError("Name cannot be empty");
    if (/[\\/]|\.\./.test(next)) return setRenameError("Name cannot contain paths");
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(next)) return setRenameError("Use letters, numbers, dot, dash and underscore only");
    if (!next.toLowerCase().endsWith(currentExt.toLowerCase())) return setRenameError(`Keep the ${currentExt} extension — change format via smart compression`);
    if (next === renameTarget.name) return setRenameError("New name is identical");
    if (files.some((f) => f.name === next)) return setRenameError("A file with that name already exists");

    setRenaming(true);
    setRenameError(null);
    try {
      const result = await renameMediaFile(renameTarget.name, next);
      toast.success(
        `Renamed to ${next}` + (result.updatedReferences ? ` · ${result.updatedReferences} link(s) updated` : "")
      );
      setRenameTarget(null);
      await fetchFiles();
    } catch (err: any) {
      setRenameError(err.message || "Rename failed");
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
      toast.error(err.message || "Couldn't verify where this file is used");
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
        toast.success(`Deleted ${target.name}`);
        setTarget(null);
        fetchFiles();
      } else {
        // Became used between check and delete
        setTarget({ name: target.name, usages: result.usages ?? [], historyReferences: result.historyReferences ?? 0 });
        toast.error("File is now in use — deletion blocked");
      }
    } catch (err: any) {
      toast.error(err.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" size={24} /></div>;

  const blocked = (target?.usages.length ?? 0) > 0;

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
            {uploading ? "Uploading..." : <>Drop images here or <span className="text-foreground underline">browse</span></>}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">JPG, PNG, WebP</p>
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

      <DashboardCard title="Library" description={`${files.length} files`}>
        <div className="divide-y divide-border">
          {files.map((f) => (
            <div key={f.name} className="flex items-center gap-4 py-3">
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center overflow-hidden">
                <img src={f.url} alt={f.name} className="w-10 h-10 rounded-lg object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{f.name}</p>
                <span className="text-xs text-muted-foreground">{formatSize(f.size)}</span>
              </div>
              <button
                onClick={() => void handleCompress(f)}
                disabled={compressing === f.name}
                aria-label={`Smart compress ${f.name}`}
                title="Smart compress"
                className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary disabled:opacity-50"
              >
                {compressing === f.name ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              </button>
              <button
                onClick={() => openRename(f)}
                aria-label={`Rename ${f.name}`}
                title="Rename"
                className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary"
              >
                <Pencil size={14} />
              </button>
              <button onClick={() => copyUrl(f.url)} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary" title="Copy URL">
                {copied === f.url ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              </button>
              <button
                onClick={() => void requestDelete(f.name)}
                disabled={checking === f.name}
                aria-label={`Delete ${f.name}`}
                title="Delete"
                className="p-2 text-muted-foreground hover:text-destructive rounded-lg hover:bg-secondary disabled:opacity-50"
              >
                {checking === f.name ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              </button>
            </div>
          ))}
        </div>
      </DashboardCard>

      <Dialog open={!!renameTarget} onOpenChange={(open) => { if (!open && !renaming) setRenameTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename file</DialogTitle>
            <DialogDescription>
              All links to this image in your content are updated automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Current name</p>
              <p className="text-sm break-all">{renameTarget?.name}</p>
            </div>
            <div>
              <label htmlFor="media-rename" className="text-xs text-muted-foreground mb-1 block">New name</label>
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
            <Button variant="ghost" size="sm" onClick={() => setRenameTarget(null)} disabled={renaming}>Cancel</Button>
            <Button size="sm" onClick={() => void submitRename()} disabled={renaming}>
              {renaming ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              Rename
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!target} onOpenChange={(open) => { if (!open && !deleting) setTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {blocked ? "This file is still in use" : `Delete ${target?.name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {blocked
                ? `“${target?.name}” is referenced by ${target?.usages.length} item${target?.usages.length === 1 ? "" : "s"}. Replace the image there first — deletion is blocked to avoid breaking published content.`
                : "No content references this file. Deleting it is permanent and cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {!blocked && (target?.historyReferences ?? 0) > 0 && (
            <p className="text-xs text-muted-foreground border border-border rounded-lg p-3">
              Heads-up: {target?.historyReferences} archived version
              {target?.historyReferences === 1 ? "" : "s"} in the change history still reference this file. Restoring
              one of those older versions after deletion would show a broken image. Live content is not affected.
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
            <AlertDialogCancel disabled={deleting}>{blocked ? "Close" : "Cancel"}</AlertDialogCancel>
            {!blocked && (
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); void confirmDelete(); }}
                disabled={deleting}
              >
                {deleting ? <Loader2 size={14} className="animate-spin mr-1" /> : <Trash2 size={14} className="mr-1" />}
                Delete permanently
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DashboardMedia;
