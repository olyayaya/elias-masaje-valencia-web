import { useState, useRef } from "react";
import { Upload, Trash2, Image as ImageIcon, FileImage } from "lucide-react";
import DashboardCard from "./DashboardCard";

interface MediaFile {
  id: string;
  name: string;
  size: string;
  url: string;
  compressed: boolean;
}

const DashboardMedia = () => {
  const [files, setFiles] = useState<MediaFile[]>([
    { id: "1", name: "hero-organic.jpg", size: "245 KB", url: "", compressed: true },
    { id: "2", name: "about-portrait.jpg", size: "180 KB", url: "", compressed: true },
    { id: "3", name: "massage-neck.jpg", size: "312 KB", url: "", compressed: true },
  ]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (fileList: FileList) => {
    const newFiles: MediaFile[] = Array.from(fileList).map((f) => ({
      id: Date.now().toString() + f.name,
      name: f.name,
      size: formatSize(f.size),
      url: URL.createObjectURL(f),
      compressed: false,
    }));
    setFiles([...newFiles, ...files]);

    // Simulate compression
    setTimeout(() => {
      setFiles((prev) =>
        prev.map((pf) =>
          newFiles.find((nf) => nf.id === pf.id) ? { ...pf, compressed: true } : pf
        )
      );
    }, 1500);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const remove = (id: string) => {
    setFiles(files.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Upload zone */}
      <DashboardCard>
        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
            dragging ? "border-gray-400 bg-gray-50" : "border-gray-200 hover:border-gray-300"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
        >
          <Upload size={24} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">
            Drop images here or <span className="text-gray-700 underline">browse</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP — auto-compressed on upload</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </div>
      </DashboardCard>

      {/* File list */}
      <DashboardCard title="Library" description={`${files.length} files`}>
        <div className="divide-y divide-gray-50">
          {files.map((f) => (
            <div key={f.id} className="flex items-center gap-4 py-3">
              <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center">
                {f.url ? (
                  <img src={f.url} alt={f.name} className="w-10 h-10 rounded-lg object-cover" />
                ) : (
                  <FileImage size={16} className="text-gray-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 truncate">{f.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-400">{f.size}</span>
                  {f.compressed ? (
                    <span className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-600 rounded">Compressed</span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 bg-yellow-50 text-yellow-600 rounded animate-pulse">Compressing…</span>
                  )}
                </div>
              </div>
              <button onClick={() => remove(f.id)} className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-50">
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
