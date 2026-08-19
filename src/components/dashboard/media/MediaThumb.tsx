import { useState } from "react";
import { Film, FileQuestion } from "lucide-react";
import { kindOf } from "@/lib/media-kind";
import type { LibraryFile } from "@/lib/media-filters";

/**
 * One thumbnail renderer shared by the list and the grid.
 *
 * Photos use the object itself (lazy `<img>`). Videos have no stored poster in the
 * Library — the frame is produced by the browser from the object itself: a muted,
 * `playsInline` element with `preload="metadata"` and a `#t=` media fragment, which
 * makes decoders paint a frame slightly after 0s instead of a black first frame.
 * Any decode/network failure degrades to the generic icon and logs the technical reason.
 */

/** Media fragment: late enough to skip a black opening frame, early enough to be cheap. */
export const POSTER_FRAGMENT = "#t=0.3";

export const videoPreviewSrc = (url: string) => `${url.split("#")[0]}${POSTER_FRAGMENT}`;

interface Props {
  file: LibraryFile;
  /** Saved sidecar poster for a video — preferred over the live frame fallback. */
  posterUrl?: string | null;
  /** Tailwind sizing classes for the frame (square in the list, aspect box in the grid). */
  className?: string;
  iconSize?: number;
}

const MediaThumb = ({ file, posterUrl, className = "w-10 h-10 rounded-lg", iconSize = 16 }: Props) => {
  const kind = kindOf(file);
  const [failed, setFailed] = useState(false);
  /** A broken poster must fall through to the live frame, not straight to the icon. */
  const [posterFailed, setPosterFailed] = useState(false);

  const frame = `bg-secondary flex items-center justify-center overflow-hidden shrink-0 ${className}`;

  if (kind === "photo" && !failed) {
    return (
      <div className={frame}>
        <img
          src={file.url}
          alt={file.name}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
          onError={() => {
            console.warn(`[library] photo thumbnail failed: ${file.name}`);
            setFailed(true);
          }}
        />
      </div>
    );
  }

  // Preference order for a video: saved poster → live frame at #t=0.3 → icon.
  if (kind === "video" && posterUrl && !posterFailed && !failed) {
    return (
      <div className={frame}>
        <img
          src={posterUrl}
          alt={file.name}
          loading="lazy"
          decoding="async"
          data-testid="video-poster-thumb"
          className="w-full h-full object-cover"
          onError={() => {
            console.warn(`[library] poster thumbnail failed: ${file.name}`);
            setPosterFailed(true);
          }}
        />
      </div>
    );
  }

  if (kind === "video" && !failed) {
    return (
      <div className={frame}>
        <video
          src={videoPreviewSrc(file.url)}
          muted
          playsInline
          preload="metadata"
          tabIndex={-1}
          aria-label={file.name}
          data-testid="video-thumb"
          className="w-full h-full object-cover pointer-events-none"
          onError={(e) => {
            const err = (e.currentTarget as HTMLVideoElement).error;
            console.warn(`[library] video thumbnail failed: ${file.name}`, err?.code, err?.message);
            setFailed(true);
          }}
        />
      </div>
    );
  }

  return (
    <div className={frame} data-testid="thumb-fallback">
      {kind === "video" ? (
        <Film size={iconSize} className="text-muted-foreground" aria-hidden="true" />
      ) : (
        <FileQuestion size={iconSize} className="text-muted-foreground" aria-hidden="true" />
      )}
    </div>
  );
};

export default MediaThumb;
