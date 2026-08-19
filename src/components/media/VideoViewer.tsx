import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Camera, Loader2, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { availableViewerBox, fitVideoSize, formatClock, seekStep, sliderStep } from "@/lib/video-fit";
import { captureVideoFrame, FrameCaptureError, type CapturedFrame } from "@/lib/video-frame";
import { makeViewerL, type ViewerLang } from "./video-viewer-i18n";

interface Props {
  src: string;
  lang: ViewerLang;
  /** Reserved vertical space (dialog header + controls) when fitting the clip. */
  chromeY?: number;
  /** Enables the frame picker. Return true once the poster is stored. */
  onSavePoster?: (frame: CapturedFrame) => Promise<boolean>;
  poster?: string;
  className?: string;
}

/**
 * Accessible video surface used by the Library preview and by Edit/Replace.
 *
 * The clip is NEVER upscaled: the element is sized in CSS pixels to
 * min(intrinsic, available), recomputed on resize and orientation change. Native
 * controls are off — a single custom control strip owns play/pause, seeking and the
 * time readout, so nothing is duplicated. Closing the parent unmounts the element,
 * which stops playback and releases the decoder.
 */
const VideoViewer = ({ src, lang, chromeY = 260, onSavePoster, poster, className = "" }: Props) => {
  const L = makeViewerL(lang);
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [intrinsic, setIntrinsic] = useState({ width: 0, height: 0 });
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  const [frame, setFrame] = useState<(CapturedFrame & { url: string }) | null>(null);
  const [savingFrame, setSavingFrame] = useState(false);
  const [frameError, setFrameError] = useState<string | null>(null);

  const measure = useCallback(() => {
    const available = availableViewerBox(
      { width: window.innerWidth || 0, height: window.innerHeight || 0 },
      { chromeY },
    );
    const wrapWidth = wrapRef.current?.clientWidth || 0;
    setBox({
      width: wrapWidth ? Math.min(wrapWidth, available.width) : available.width,
      height: available.height,
    });
  }, [chromeY]);

  useLayoutEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [measure]);

  // Revoke the object URL of a discarded frame preview — no leaked blobs on close.
  useEffect(() => () => { if (frame) URL.revokeObjectURL(frame.url); }, [frame]);

  // Hard stop on unmount: no audio may survive a closed dialog.
  useEffect(() => {
    const v = videoRef.current;
    return () => {
      try {
        v?.pause();
      } catch {
        /* jsdom */
      }
    };
  }, []);

  const size = fitVideoSize(intrinsic, box);
  const styleSize = size.width && size.height ? { width: size.width, height: size.height } : undefined;

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play()?.catch(() => undefined);
    else v.pause();
  }, []);

  const seekBy = useCallback((delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    const max = Number.isFinite(v.duration) ? v.duration : duration;
    v.currentTime = Math.min(Math.max(0, v.currentTime + delta), max || 0);
  }, [duration]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Never hijack typing in the numeric/text controls of a surrounding dialog.
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" && (e.target as HTMLInputElement).type !== "range") return;
    if (e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      togglePlay();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      seekBy(seekStep(duration));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      seekBy(-seekStep(duration));
    }
  };

  const capture = async () => {
    const v = videoRef.current;
    setFrameError(null);
    if (!v) return;
    try {
      const captured = await captureVideoFrame(v);
      if (frame) URL.revokeObjectURL(frame.url);
      setFrame({ ...captured, url: URL.createObjectURL(captured.blob) });
    } catch (e) {
      const code = e instanceof FrameCaptureError ? e.code : "encode";
      console.warn("[video-viewer] frame capture failed", e);
      setFrameError(
        code === "cors" ? L("frameFailedCors") : code === "notReady" ? L("frameFailedNotReady") : L("frameFailedEncode"),
      );
    }
  };

  const saveFrame = async () => {
    if (!frame || !onSavePoster) return;
    setSavingFrame(true);
    try {
      const ok = await onSavePoster({
        blob: frame.blob, width: frame.width, height: frame.height, ext: frame.ext, mimeType: frame.mimeType,
      });
      if (ok) {
        URL.revokeObjectURL(frame.url);
        setFrame(null);
      } else {
        setFrameError(L("saveFailed"));
      }
    } catch (e) {
      console.warn("[video-viewer] poster save failed", e);
      setFrameError(L("saveFailed"));
    } finally {
      setSavingFrame(false);
    }
  };

  const cancelFrame = () => {
    if (frame) URL.revokeObjectURL(frame.url);
    setFrame(null);
    setFrameError(null);
  };

  return (
    <div
      ref={wrapRef}
      className={`space-y-3 outline-none ${className}`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      data-testid="video-viewer"
    >
      <div className="flex justify-center bg-black/90 rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          playsInline
          preload="metadata"
          crossOrigin="anonymous"
          data-testid="viewer-video"
          className="object-contain max-w-full"
          style={styleSize}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            setIntrinsic({ width: v.videoWidth, height: v.videoHeight });
            setDuration(Number.isFinite(v.duration) ? v.duration : 0);
            measure();
          }}
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? L("pause") : L("play")}
          title={playing ? L("pause") : L("play")}
          data-testid="viewer-playpause"
          className="p-2 rounded-full bg-secondary text-foreground hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>

        <input
          type="range"
          min={0}
          max={duration || 0}
          step={sliderStep(duration)}
          value={Math.min(current, duration || 0)}
          aria-label={L("seek")}
          title={L("seek")}
          data-testid="viewer-seek"
          className="flex-1 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          onChange={(e) => {
            const v = videoRef.current;
            const next = Number(e.target.value);
            setCurrent(next);
            if (v) v.currentTime = next;
          }}
        />

        <span className="text-xs tabular-nums text-muted-foreground" aria-label={L("time")} data-testid="viewer-time">
          {formatClock(current)} / {formatClock(duration)}
        </span>
      </div>

      <p className="text-xs text-muted-foreground">{L("keyboardHint")}</p>

      {onSavePoster && (
        <div className="space-y-2">
          <Button type="button" size="sm" variant="outline" onClick={() => void capture()} data-testid="viewer-capture">
            <Camera size={14} className="mr-1.5" /> {L("useFrame")}
          </Button>

          {frame && (
            <div className="flex flex-wrap items-center gap-3" data-testid="viewer-frame-preview">
              <img
                src={frame.url}
                alt={L("framePreview")}
                className="h-24 w-auto rounded-md border border-border bg-secondary object-contain"
              />
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" onClick={() => void saveFrame()} disabled={savingFrame} data-testid="viewer-frame-save">
                  {savingFrame ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : null}
                  {savingFrame ? L("saving") : L("save")}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={cancelFrame} disabled={savingFrame} data-testid="viewer-frame-cancel">
                  {L("cancel")}
                </Button>
              </div>
              <span className="text-xs text-muted-foreground">{frame.width}×{frame.height}</span>
            </div>
          )}

          {frameError && (
            <p className="text-xs text-destructive" role="alert" data-testid="viewer-frame-error">{frameError}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoViewer;
