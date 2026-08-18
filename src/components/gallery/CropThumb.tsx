import { useState } from "react";
import { clampCrop, cropStyle, type GalleryCrop } from "@/lib/gallery-crop";

interface Props {
  src: string;
  alt: string;
  crop: Partial<GalleryCrop> | null | undefined;
  /** Extra attributes forwarded to the framed <img>. */
  loading?: "lazy" | "eager";
  decoding?: "async" | "sync" | "auto";
  width?: number;
  height?: number;
  testId?: string;
  fullSrc?: string;
  className?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}

/**
 * Single renderer for every 4:3 gallery tile — dashboard preview, dashboard list
 * and the public grid all go through this, so the admin always sees exactly what
 * visitors get. When the crop is zoomed out below 1 the empty area is filled by a
 * blurred, dimmed copy of the same image instead of a white/black hole.
 */
const CropThumb = ({
  src,
  alt,
  crop,
  loading,
  decoding,
  width,
  height,
  testId,
  fullSrc,
  className,
  onError,
}: Props) => {
  const [aspect, setAspect] = useState<number | null>(null);
  const zoomedOut = clampCrop(crop).thumbnail_zoom < 1;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {zoomedOut && (
        <img
          src={src}
          alt=""
          aria-hidden="true"
          data-testid={testId ? `${testId}-backdrop` : undefined}
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-50"
        />
      )}
      <img
        src={src}
        alt={alt}
        loading={loading}
        decoding={decoding}
        width={width}
        height={height}
        draggable={false}
        data-testid={testId}
        data-full-src={fullSrc}
        onLoad={(e) => {
          const el = e.currentTarget;
          if (el.naturalWidth > 0 && el.naturalHeight > 0) setAspect(el.naturalWidth / el.naturalHeight);
        }}
        onError={onError}
        style={cropStyle(crop, aspect)}
        className={`relative w-full h-full ${className ?? ""}`}
      />
    </div>
  );
};

export default CropThumb;
