import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Check, Film, ImageIcon, AlertTriangle, RotateCw } from "lucide-react";
import { kindOf, type MediaKind } from "@/lib/media-kind";
import { listAllMediaObjects } from "@/lib/storage-list";

interface StorageFile {
  name: string;
  url: string;
  kind: MediaKind;
}

interface Props {
  open: boolean;
  /** Restrict the list to one media kind (gallery item media vs. video poster). */
  kind: "photo" | "video";
  title: string;
  description: string;
  emptyLabel: string;
  cancelLabel: string;
  selectLabel: string;
  currentUrl?: string;
  searchPlaceholder?: string;
  noMatchLabel?: string;
  errorLabel?: string;
  retryLabel?: string;
  /**
   * Multi-select is only ever enabled for "add new items". Replacing the file of an
   * existing item, and picking a video cover, stay strictly single-select.
   */
  multiple?: boolean;
  /** Confirm label for multi-select, "{n}" is replaced by the selection count. */
  selectManyLabel?: string;
  selectAllLabel?: string;
  clearLabel?: string;
  selectedCountLabel?: string;
  onClose: () => void;
  onSelect: (url: string) => void;
  onSelectMany?: (urls: string[]) => void;
}

const fill = (s: string, vars: Record<string, string>) =>
  Object.entries(vars).reduce((a, [k, v]) => a.split(`{${k}}`).join(v), s);

/**
 * Read-only browser over the existing Library bucket. Uploading stays in Dashboard → Library
 * so every file keeps going through the compression / video pipeline.
 */
const GalleryMediaPicker = ({
  open, kind, title, description, emptyLabel, cancelLabel, selectLabel, currentUrl,
  searchPlaceholder = "Search by file name", noMatchLabel, errorLabel, retryLabel = "Retry",
  multiple = false, selectManyLabel = "Add {n}", selectAllLabel = "Select all visible",
  clearLabel = "Clear", selectedCountLabel = "{n} selected",
  onClose, onSelect, onSelectMany,
}: Props) => {
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string[]>(currentUrl ? [currentUrl] : []);
  const [search, setSearch] = useState("");
  /** Last plain/ctrl-clicked row — the origin of a Shift range in the visible list. */
  const anchor = useRef<string | null>(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      // Every page of the bucket root — a single limited list would silently hide files.
      const all = await listAllMediaObjects();
      setFiles(
        all
          .filter((f) => !f.name.startsWith("blog/"))
          .map((f) => ({
            name: f.name,
            url: supabase.storage.from("media").getPublicUrl(f.name).data.publicUrl,
            kind: kindOf({ name: f.name, mimeType: f.mimeType }),
          }))
          .filter((f) => f.kind === kind),
      );
    } catch {
      setFiles([]);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    if (!open) return;
    // Opening (or cancelling and re-opening) always starts from a clean selection.
    setSelected(currentUrl ? [currentUrl] : []);
    anchor.current = null;
    setSearch("");
    void fetchFiles();
  }, [open, currentUrl, fetchFiles]);

  // The Library grows past what a single scroll can reasonably present, so the list
  // is filtered by file name (case- and accent-insensitive) before rendering.
  const normalize = (v: string) =>
    v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const visible = useMemo(() => {
    const q = normalize(search.trim());
    if (!q) return files;
    return files.filter((f) => normalize(f.name).includes(q));
  }, [files, search]);

  const isSelected = (url: string) => selected.includes(url);

  /**
   * Pointer/touch friendly: a plain tap toggles, so several files can be picked
   * without a keyboard. Ctrl/Cmd behaves the same (explicit additive toggle) and
   * Shift extends a range inside the *currently filtered* list.
   */
  const handlePick = (url: string, e: { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean }) => {
    if (!multiple) {
      setSelected([url]);
      return;
    }
    if (e.shiftKey && anchor.current) {
      const from = visible.findIndex((f) => f.url === anchor.current);
      const to = visible.findIndex((f) => f.url === url);
      if (from !== -1 && to !== -1) {
        const [a, b] = from <= to ? [from, to] : [to, from];
        const range = visible.slice(a, b + 1).map((f) => f.url);
        // A range extends the selection; files filtered out stay untouched.
        setSelected((cur) => Array.from(new Set([...cur, ...range])));
        return;
      }
    }
    anchor.current = url;
    setSelected((cur) => (cur.includes(url) ? cur.filter((u) => u !== url) : [...cur, url]));
  };

  const selectAllVisible = () =>
    setSelected((cur) => Array.from(new Set([...cur, ...visible.map((f) => f.url)])));

  const clearSelection = () => {
    setSelected([]);
    anchor.current = null;
  };

  const confirm = () => {
    if (selected.length === 0) return;
    if (multiple) onSelectMany?.(selected);
    else onSelect(selected[0]);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {!loading && !failed && files.length > 0 && (
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="mb-1"
          />
        )}

        {multiple && !loading && !failed && files.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" type="button" onClick={selectAllVisible} disabled={visible.length === 0}>
              {selectAllLabel}
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={clearSelection} disabled={selected.length === 0}>
              {clearLabel}
            </Button>
            <span className="text-xs text-muted-foreground" data-testid="picker-selected-count" aria-live="polite">
              {fill(selectedCountLabel, { n: String(selected.length) })}
            </span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-muted-foreground" size={20} />
          </div>
        ) : failed ? (
          <div className="py-8 text-center space-y-3" data-testid="picker-error" role="alert">
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              {errorLabel ?? "Could not load the Library files."}
            </p>
            <Button size="sm" variant="outline" onClick={() => void fetchFiles()}>
              <RotateCw size={13} className="mr-1.5" />
              {retryLabel}
            </Button>
          </div>
        ) : files.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">{emptyLabel}</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">{noMatchLabel ?? emptyLabel}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3" role="listbox" aria-multiselectable={multiple}>
            {visible.map((f) => (
              <button
                key={f.name}
                type="button"
                role="option"
                aria-selected={isSelected(f.url)}
                onClick={(e) => handlePick(f.url, e)}
                className={`relative rounded-lg overflow-hidden border-2 transition-colors ${
                  isSelected(f.url) ? "border-primary" : "border-border hover:border-muted-foreground"
                }`}
                title={f.name}
              >
                <div className="aspect-square bg-secondary flex items-center justify-center overflow-hidden">
                  {f.kind === "photo" ? (
                    <img src={f.url} alt="" loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <Film size={22} className="text-muted-foreground" />
                  )}
                </div>
                <span className="block px-1.5 py-1 text-[10px] text-muted-foreground truncate text-left">
                  {f.name}
                </span>
                <span
                  aria-hidden="true"
                  className={`absolute top-1 right-1 rounded-full p-0.5 border ${
                    isSelected(f.url)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background/80 text-transparent border-border"
                  }`}
                >
                  <Check size={12} />
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>{cancelLabel}</Button>
          <Button disabled={selected.length === 0} onClick={confirm}>
            <ImageIcon size={14} className="mr-1.5" />
            {multiple ? fill(selectManyLabel, { n: String(selected.length) }) : selectLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GalleryMediaPicker;
