import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Check, Film, ImageIcon } from "lucide-react";
import { kindOf, type MediaKind } from "@/lib/media-kind";

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
  onClose: () => void;
  onSelect: (url: string) => void;
}

/**
 * Read-only browser over the existing Library bucket. Uploading stays in Dashboard → Library
 * so every file keeps going through the compression / video pipeline.
 */
const GalleryMediaPicker = ({
  open, kind, title, description, emptyLabel, cancelLabel, selectLabel, currentUrl,
  searchPlaceholder = "Search by file name", noMatchLabel, onClose, onSelect,
}: Props) => {
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(currentUrl ?? null);
  const [search, setSearch] = useState("");

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.storage.from("media").list("", {
      limit: 1000,
      sortBy: { column: "created_at", order: "desc" },
    });
    setFiles(
      (data ?? [])
        .filter((f) => f.name !== ".emptyFolderPlaceholder" && !f.name.startsWith("blog/"))
        .map((f) => ({
          name: f.name,
          url: supabase.storage.from("media").getPublicUrl(f.name).data.publicUrl,
          kind: kindOf({ name: f.name, mimeType: (f.metadata as { mimetype?: string } | null)?.mimetype }),
        }))
        .filter((f) => f.kind === kind),
    );
    setLoading(false);
  }, [kind]);

  useEffect(() => {
    if (!open) return;
    setSelected(currentUrl ?? null);
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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {!loading && files.length > 0 && (
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="mb-1"
          />
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-muted-foreground" size={20} />
          </div>
        ) : files.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">{emptyLabel}</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">{noMatchLabel ?? emptyLabel}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {visible.map((f) => (
              <button
                key={f.name}
                type="button"
                onClick={() => setSelected(f.url)}
                className={`relative rounded-lg overflow-hidden border-2 transition-colors ${
                  selected === f.url ? "border-primary" : "border-border hover:border-muted-foreground"
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
                {selected === f.url && (
                  <span className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                    <Check size={12} />
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>{cancelLabel}</Button>
          <Button
            disabled={!selected}
            onClick={() => {
              if (selected) onSelect(selected);
            }}
          >
            <ImageIcon size={14} className="mr-1.5" />
            {selectLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GalleryMediaPicker;
