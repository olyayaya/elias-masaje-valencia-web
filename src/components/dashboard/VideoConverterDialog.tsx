import { useEffect, useRef, useState } from "react";
import { Loader2, Download, Wand2, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatFileSize } from "@/lib/image-utils";
import {
  availableFormats,
  evaluateVideoSaving,
  formatDuration,
  MAX_CONVERT_BYTES,
  MEMORY_WARN_BYTES,
  outputNameFor,
  smartPreset,
  targetDimensions,
  type EncoderCaps,
  type ResolutionChoice,
  type VideoFormat,
  type VideoMeta,
  type VideoQuality,
} from "@/lib/video-convert";
import { convertVideo, isConverterSupported, probeEncoders, probeVideoMeta } from "@/lib/video-ffmpeg";
import { commitVideoReplacement } from "@/lib/media-usage";
import { removeObject, uploadResumable } from "@/lib/video-upload";
import { collisionSafeName } from "@/lib/media-kind";
import type { LibraryT } from "./media/i18n";

export interface ConverterFile {
  name: string;
  url: string;
  size: number;
}

interface Props {
  file: ConverterFile;
  L: LibraryT;
  onClose: () => void;
  onReplaced: (result: { updatedReferences?: number; historyReferences?: number; aliased?: boolean; warning?: string }, newName: string) => void;
}

type Phase = "loading" | "ready" | "converting" | "done" | "uploading" | "error";

const RESOLUTIONS: ResolutionChoice[] = ["original", "1080", "720", "480"];

/**
 * Browser-side video converter. The heavy ffmpeg core is only fetched when this dialog is
 * rendered (see video-ffmpeg's dynamic imports), and every option is gated on the encoders
 * the loaded core actually reports.
 */
const VideoConverterDialog = ({ file, L, onClose, onReplaced }: Props) => {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [caps, setCaps] = useState<EncoderCaps | null>(null);
  const [source, setSource] = useState<File | null>(null);

  const [format, setFormat] = useState<VideoFormat>("mp4");
  const [resolution, setResolution] = useState<ResolutionChoice>("original");
  const [quality, setQuality] = useState<VideoQuality>("balanced");

  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ blob: Blob; size: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const aliveRef = useRef(true);
  const resultUrlRef = useRef<string | null>(null);

  const tooLarge = file.size > MAX_CONVERT_BYTES;

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      abortRef.current?.abort();
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    };
  }, []);

  // Load the source bytes + probe the engine once, when the dialog opens.
  useEffect(() => {
    if (tooLarge) {
      setPhase("error");
      setError(L("tooLargeConvert", { m: Math.round(MAX_CONVERT_BYTES / (1024 * 1024)) }));
      return;
    }
    if (!isConverterSupported()) {
      setPhase("error");
      setError(L("notSupported"));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(file.url, { cache: "no-store" });
        if (!res.ok) throw new Error(`Could not read the video (${res.status})`);
        const blob = await res.blob();
        const asFile = new File([blob], file.name, { type: blob.type || "video/mp4" });
        const m = await probeVideoMeta(asFile);
        const c = await probeEncoders();
        if (cancelled || !aliveRef.current) return;
        setSource(asFile);
        setMeta(m);
        setCaps(c);
        const preset = smartPreset(m, c);
        if (!preset) throw new Error(L("engineFailed"));
        setFormat(preset.format);
        setResolution(preset.resolution);
        setQuality(preset.quality);
        setPhase("ready");
      } catch (e) {
        if (cancelled || !aliveRef.current) return;
        setPhase("error");
        setError((e as Error).message || L("engineFailed"));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.url, file.name]);

  const formats = caps ? availableFormats(caps) : [];
  const busy = phase === "converting" || phase === "uploading";

  const applyPreset = () => {
    if (!meta || !caps) return;
    const preset = smartPreset(meta, caps);
    if (!preset) return;
    setFormat(preset.format);
    setResolution(preset.resolution);
    setQuality(preset.quality);
  };

  const runConvert = async () => {
    if (!source || !meta || !caps) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("converting");
    setProgress(0);
    setError(null);
    setResult(null);
    try {
      const out = await convertVideo(
        source,
        { format, quality, resolution, meta, caps },
        {
          signal: controller.signal,
          onProgress: (p) => aliveRef.current && setProgress(Math.round(p.ratio * 100)),
        },
      );
      if (!aliveRef.current) return;
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = URL.createObjectURL(out.blob);
      setResult(out);
      setPhase("done");
    } catch (e) {
      if (!aliveRef.current) return;
      if ((e as DOMException)?.name === "AbortError") {
        toast.info(L("convertCancelled"));
        setPhase("ready");
        return;
      }
      setPhase("error");
      setError((e as Error).message || L("convertFailed"));
    } finally {
      abortRef.current = null;
    }
  };

  const verdict = result ? evaluateVideoSaving(file.size, result.size) : null;

  const replaceOriginal = async () => {
    if (!result || !verdict?.ok) return;
    const newName = outputNameFor(file.name, format);
    const stagedName = collisionSafeName(`staged-${newName}`);
    const contentType = format === "mp4" ? "video/mp4" : "video/webm";
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("uploading");
    setProgress(0);
    try {
      await uploadResumable(stagedName, result.blob, contentType, {
        signal: controller.signal,
        onProgress: (sent, total) =>
          aliveRef.current && setProgress(total ? Math.round((sent / total) * 100) : 0),
      });
      const commit = await commitVideoReplacement({
        fileName: file.name,
        stagedName,
        newName,
        contentType,
        enforceSaving: true,
      });
      if (!aliveRef.current) return;
      onReplaced(commit, commit.newName ?? newName);
    } catch (e) {
      // Anything past a successful upload is cleaned server-side; a failed upload cleans itself.
      await removeObject(stagedName);
      if (!aliveRef.current) return;
      if ((e as DOMException)?.name === "AbortError") {
        toast.info(L("uploadCancelled"));
      } else {
        toast.error((e as Error).message || L("replaceFailed"));
      }
      setPhase("done");
    } finally {
      abortRef.current = null;
    }
  };

  const dims = meta ? targetDimensions(meta.width, meta.height, resolution) : null;

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{L("convertTitle")}</DialogTitle>
          <DialogDescription>{L("convertDesc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-xs text-muted-foreground break-all">
            <span className="text-foreground">{file.name}</span>
            {meta && (
              <> · {meta.width}×{meta.height} · {formatDuration(meta.duration)} · {formatFileSize(file.size)}</>
            )}
          </div>

          {phase === "loading" && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" /> {L("loadingEngine")}
            </p>
          )}

          {error && (
            <p role="alert" className="flex items-start gap-2 text-xs text-destructive">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}

          {file.size > MEMORY_WARN_BYTES && !tooLarge && (
            <p className="text-xs text-muted-foreground border border-border rounded-lg p-3">
              {L("memoryWarning")}
            </p>
          )}

          {phase !== "loading" && phase !== "error" && caps && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="vc-format" className="text-xs">{L("format")}</Label>
                <Select value={format} onValueChange={(v) => setFormat(v as VideoFormat)} disabled={busy}>
                  <SelectTrigger id="vc-format"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {formats.map((f) => (
                      <SelectItem key={f} value={f}>{f.toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vc-res" className="text-xs">{L("resolution")}</Label>
                <Select value={resolution} onValueChange={(v) => setResolution(v as ResolutionChoice)} disabled={busy}>
                  <SelectTrigger id="vc-res"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RESOLUTIONS.map((r) => (
                      <SelectItem key={r} value={r}>{r === "original" ? L("original") : `${r}p`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vc-quality" className="text-xs">{L("quality")}</Label>
                <Select value={quality} onValueChange={(v) => setQuality(v as VideoQuality)} disabled={busy}>
                  <SelectTrigger id="vc-quality"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">{L("qHigh")}</SelectItem>
                    <SelectItem value="balanced">{L("qBalanced")}</SelectItem>
                    <SelectItem value="small">{L("qSmall")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {dims && phase !== "error" && (
            <p className="text-xs text-muted-foreground">
              {L("result")}: {dims.width}×{dims.height} · {outputNameFor(file.name, format)} — {L("noUpscale")}
            </p>
          )}

          {busy && (
            <div className="space-y-1.5">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground">
                {phase === "converting" ? L("converting", { p: progress }) : L("replacing", { p: progress })}
              </p>
            </div>
          )}

          {result && verdict && (
            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-sm text-foreground">
                {L("saving", {
                  a: formatFileSize(file.size),
                  b: formatFileSize(result.size),
                  p: verdict.ok ? verdict.savedPercent : 0,
                })}
              </p>
              {verdict.ok === false && (
                <p className="text-xs text-muted-foreground">
                  {verdict.reason === "notSmaller" ? L("biggerResult") : L("alreadyOptimizedVideo")}
                </p>
              )}
              <p className="text-xs text-muted-foreground">{L("convertNote")}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                >
                  <a href={resultUrlRef.current ?? "#"} download={outputNameFor(file.name, format)}>
                    <Download size={14} className="mr-1" />
                    {L("downloadResult")}
                  </a>
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          {busy ? (
            <Button variant="ghost" size="sm" onClick={() => abortRef.current?.abort()}>
              {L("cancel")}
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={onClose}>{L("close")}</Button>
          )}
          {phase !== "error" && phase !== "loading" && (
            <Button variant="outline" size="sm" onClick={applyPreset} disabled={busy}>
              <Wand2 size={14} className="mr-1" />
              {L("smartPreset")}
            </Button>
          )}
          {phase !== "error" && phase !== "loading" && (
            <Button size="sm" onClick={() => void runConvert()} disabled={busy || !source}>
              {phase === "converting" ? <Loader2 size={14} className="animate-spin mr-1" /> : <RefreshCw size={14} className="mr-1" />}
              {L("startConvert")}
            </Button>
          )}
          {result && (
            <Button size="sm" onClick={() => void replaceOriginal()} disabled={busy || !verdict?.ok}>
              {phase === "uploading" ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              {L("replaceOriginal")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VideoConverterDialog;
