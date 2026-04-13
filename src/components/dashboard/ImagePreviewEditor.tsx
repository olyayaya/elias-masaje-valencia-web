import { useState } from "react";
import { Check } from "lucide-react";

const POSITIONS = [
  { label: "↖", value: "left top" },
  { label: "↑", value: "center top" },
  { label: "↗", value: "right top" },
  { label: "←", value: "left center" },
  { label: "•", value: "center center" },
  { label: "→", value: "right center" },
  { label: "↙", value: "left bottom" },
  { label: "↓", value: "center bottom" },
  { label: "↘", value: "right bottom" },
];

const ASPECT_RATIOS = [
  { label: "Wide", value: "21/9" },
  { label: "16:9", value: "16/9" },
  { label: "4:3", value: "4/3" },
  { label: "Square", value: "1/1" },
];

interface ImagePreviewEditorProps {
  url: string;
  position: string;
  onPositionChange: (position: string) => void;
}

const ImagePreviewEditor = ({ url, position, onPositionChange }: ImagePreviewEditorProps) => {
  const [aspectRatio, setAspectRatio] = useState("16/9");

  if (!url || !url.startsWith("http")) return null;

  return (
    <div className="mt-3 space-y-3">
      {/* Preview with current position */}
      <div className="relative rounded-lg overflow-hidden border border-border bg-muted">
        <div style={{ aspectRatio }} className="relative">
          <img
            src={url}
            alt="Preview"
            className="w-full h-full object-cover transition-all duration-300"
            style={{ objectPosition: position || "center center" }}
          />
          {/* Position grid overlay */}
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-0 hover:opacity-100 transition-opacity duration-200">
            {POSITIONS.map((pos) => (
              <button
                key={pos.value}
                type="button"
                onClick={() => onPositionChange(pos.value)}
                className={`flex items-center justify-center transition-all ${
                  position === pos.value
                    ? "bg-foreground/30"
                    : "bg-transparent hover:bg-foreground/10"
                }`}
                title={pos.value}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] transition-all ${
                  position === pos.value
                    ? "bg-foreground text-background shadow-md scale-110"
                    : "bg-background/70 text-foreground/70 backdrop-blur-sm"
                }`}>
                  {position === pos.value ? <Check size={10} /> : pos.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between gap-4">
        {/* Position pills */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground mr-1">Focus:</span>
          {POSITIONS.map((pos) => (
            <button
              key={pos.value}
              type="button"
              onClick={() => onPositionChange(pos.value)}
              className={`w-5 h-5 rounded text-[10px] flex items-center justify-center transition-colors ${
                position === pos.value
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
              title={pos.value}
            >
              {position === pos.value ? <Check size={8} /> : pos.label}
            </button>
          ))}
        </div>

        {/* Aspect ratio preview selector */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground mr-1">Preview:</span>
          {ASPECT_RATIOS.map((ar) => (
            <button
              key={ar.value}
              type="button"
              onClick={() => setAspectRatio(ar.value)}
              className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                aspectRatio === ar.value
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {ar.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ImagePreviewEditor;
