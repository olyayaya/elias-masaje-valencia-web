import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { optimizeImage, getOptimizedExtension, formatFileSize } from "@/lib/image-utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Check, Loader2, ImageIcon, X } from "lucide-react";
import { toast } from "sonner";

interface MediaFile {
  name: string;
  url: string;
  size: number;
}

interface ImagePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  currentUrl?: string;
}

const ImagePicker = ({ open, onClose, onSelect, currentUrl }: ImagePickerProps) => {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<string | null>(currentUrl || null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async () => {
    const { data } = await supabase.storage.from("media").list("", {
      limit: 200,
      sortBy: { column: "created_at", order: "desc" },
    });
    if (data) {
      setFiles(
        data
          .filter((f) => f.name !== ".emptyFolderPlaceholder" && !f.name.startsWith("blog/"))
          .map((f) => ({
            name: f.name,
            url: supabase.storage.from("media").getPublicUrl(f.name).data.publicUrl,
            size: f.metadata?.size || 0,
          }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) {
      setSelected(currentUrl || null);
      fetchFiles();
    }
  }, [open, currentUrl, fetchFiles]);

  const handleUpload = async (fileList: FileList) => {
    setUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        if (!file.type.startsWith("image/")) continue;
        const optimized = await optimizeImage(file);
        const ext = getOptimizedExtension();
        const name = `${Date.now()}-${file.name.replace(/\.[^.]+$/, "")}.${ext}`;
        const { error } = await supabase.storage.from("media").upload(name, optimized.blob, {
          contentType: optimized.blob.type,
          cacheControl: "3600",
          upsert: false,
        });
        if (error) throw error;
        const saved = formatFileSize(optimized.originalSize - optimized.optimizedSize);
        toast.success(`Uploaded & optimized (saved ${saved})`);
      }
      await fetchFiles();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const confirm = () => {
    if (selected) {
      onSelect(selected);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Image</DialogTitle>
          <DialogDescription>Choose from your media library or upload a new image.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Upload size={14} className="mr-1.5" />}
            Upload New
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleUpload(e.target.files)}
          />
          {selected && (
            <Button size="sm" onClick={confirm}>
              <Check size={14} className="mr-1.5" />
              Use Selected
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-muted-foreground" size={24} />
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ImageIcon size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No images yet. Upload one to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {files.map((f) => (
                <button
                  key={f.name}
                  onClick={() => setSelected(f.url)}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:opacity-90 ${
                    selected === f.url
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-transparent hover:border-muted-foreground/20"
                  }`}
                >
                  <img
                    src={f.url}
                    alt={f.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {selected === f.url && (
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check size={12} className="text-primary-foreground" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImagePicker;
