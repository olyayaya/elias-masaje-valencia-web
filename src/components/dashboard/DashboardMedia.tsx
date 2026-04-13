import { useState, useEffect, useRef } from "react";
import { Upload, Trash2, FileImage, Loader2, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { optimizeImage, getOptimizedExtension, formatFileSize } from "@/lib/image-utils";
import DashboardCard from "./DashboardCard";

interface MediaFile {
  name: string;
  size: number;
  url: string;
  created_at: string;
}

const DashboardMedia = () => {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

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

  const remove = async (name: string) => {
    await supabase.storage.from("media").remove([name]);
    fetchFiles();
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
              <button onClick={() => copyUrl(f.url)} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary" title="Copy URL">
                {copied === f.url ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              </button>
              <button onClick={() => remove(f.name)} className="p-2 text-muted-foreground hover:text-destructive rounded-lg hover:bg-secondary">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </DashboardCard>
    </div>
  );
};

export default DashboardMedia;
