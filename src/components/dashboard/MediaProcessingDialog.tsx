import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, Loader2, RotateCcw, Undo2, Upload, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatFileSize } from "@/lib/image-utils";
import { supabase } from "@/integrations/supabase/client";
import { classifyUpload, collisionSafeName, PHOTO_ACCEPT, VIDEO_ACCEPT } from "@/lib/media-kind";
import { blobToBase64 } from "@/lib/media-compress";
import { commitVideoReplacement, replaceMediaFile } from "@/lib/media-usage";
import { removeObject, stagedObjectName, uploadResumable } from "@/lib/video-upload";
import { replaceGate } from "@/lib/media-backend";
import {
  DEFAULT_BACKGROUND, MAX_QUALITY, MIN_QUALITY,
  availablePhotoFormats, clampQuality, evaluatePhotoSaving, loadImageElement, mayHaveAlpha,
  encodePhoto, photoOutputName, photoTargetDimensions, probePhotoCaps, smartPhotoPreset, supportsQuality,
  willFlattenAlpha,
  type PhotoFormat, type PhotoSettings, type SizeChoice,
} from "@/lib/photo-encode";
import {
  AUDIO_KBPS_CHOICES, CRF_RANGE, MAX_CONVERT_BYTES, MEMORY_WARN_BYTES, MIME_BY_FORMAT,
  availableFormatsWithMov, canRemuxWithoutReencode, clampBitrate, clampCrf, defaultCrf, estimateSizeBytes,
  evaluateVideoSaving, exceedsMemoryBudget, formatDuration, isMobileBrowser, isWebFormat,
  memorySafeSettings, originalContentType, outputNameFor, smartPreset, targetDimensions,
  type EncoderCaps, type FpsChoice, type RateControl, type ResolutionChoice,
  type SpeedChoice, type VideoFormat, type VideoMeta,
} from "@/lib/video-convert";

import type { LibraryT } from "./media/i18n";
import VideoViewer from "@/components/media/VideoViewer";
import { saveLibraryPoster } from "@/lib/library-poster";
import type { ViewerLang } from "@/components/media/video-viewer-i18n";

export interface ProcessingItem {
  id: string;
  file: File;
  kind: "photo" | "video";
  /** Present when this run edits/replaces an existing library object. */
  replace?: { name: string; size: number; publishedInGallery?: boolean };
  /** Internal: true once the admin picked a new local source via "Replace file". */
  picked?: boolean;
}

interface Props {
  items: ProcessingItem[];
  L: LibraryT;
  existingNames: string[];
  onClose: () => void;
  /** Called after every successful Apply so the library can refresh in place. */
  onApplied: (name: string, replacedName?: string) => void;
}

type Mode = "smart" | "advanced" | "original";
type Phase = "idle" | "processing" | "done" | "applying";

interface VideoSettings {
  format: VideoFormat;
  resolution: ResolutionChoice;
  customShortSide: number;
  fps: FpsChoice;
  speed: SpeedChoice;
  rate: RateControl;
  removeAudio: boolean;
  audioKbps: number;
}

interface Result {
  blob: Blob;
  size: number;
  url: string;
  name: string;
  contentType: string;
  format: string;
  width: number;
  height: number;
  /** "original" = untouched bytes, "muted" = lossless remux, undefined = re-encoded. */
  passthrough?: "original" | "muted";
  /** Only for a muted remux: whether the source really had an audio track. */
  hadAudio?: boolean;
}


const SIZES: SizeChoice[] = ["original", "1920", "1600", "1280", "custom"];
const RESOLUTIONS: ResolutionChoice[] = ["original", "1080", "720", "480", "custom"];
const FPS_CHOICES: FpsChoice[] = ["original", "30", "25", "24"];

const defaultVideoSettings = (meta: VideoMeta, caps: EncoderCaps): VideoSettings | null => {
  const preset = smartPreset(meta, caps);
  if (!preset) return null;
  return {
    format: preset.format,
    resolution: preset.resolution,
    customShortSide: 720,
    fps: "original",
    speed: "fast",
    rate: { mode: "crf", crf: defaultCrf(preset.format, preset.quality) },
    removeAudio: false,
    audioKbps: 128,
  };
};

/**
 * One processing pipeline for every way media enters the library: upload, drag & drop and
 * Edit/Replace. Files are queued locally; nothing reaches Storage until Apply succeeds, and
 * "Keep original" only throws the local result away.
 */
const MediaProcessingDialog = ({ items, L, existingNames, onClose, onApplied }: Props) => {
  /** Names uploaded during this queue, so later items cannot collide with them. */
  const appliedNames = useRef<string[]>([]);
  // The queue is stateful only so "Replace file" can swap the local source of the current
  // item while keeping its replace target (name/size/publishedInGallery) intact.
  // Read the language off the document instead of the i18n context: this dialog is
  // rendered by tests (and by the dashboard) outside of an I18nProvider.
  const docLang = typeof document !== "undefined" ? document.documentElement.lang : "es";
  const viewerLang: ViewerLang = (["en", "es", "ru"] as const).includes(docLang as ViewerLang)
    ? (docLang as ViewerLang)
    : "es";
  const [queue, setQueue] = useState<ProcessingItem[]>(items);
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<Mode>("smart");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [compare, setCompare] = useState<"original" | "result">("original");
  const [confirmed, setConfirmed] = useState(false);
  const [reuseSettings, setReuseSettings] = useState(true);
  /** "Original file" mode: no re-encode. Optionally drop the audio via a stream-copy remux. */
  const [stripAudioOnly, setStripAudioOnly] = useState(false);
  /** Set only after an out-of-memory failure: the explicit, opt-in lighter preset. */
  const [memoryFallback, setMemoryFallback] = useState<
    { format: VideoFormat; resolution: ResolutionChoice; customShortSide: number } | null
  >(null);

  const [photo, setPhoto] = useState<PhotoSettings | null>(null);
  const [analyzing, setAnalyzing] = useState(true);

  const [photoSource, setPhotoSource] = useState<{ width: number; height: number; hasAlpha: boolean } | null>(null);
  const [video, setVideo] = useState<VideoSettings | null>(null);
  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [caps, setCaps] = useState<EncoderCaps | null>(null);

  const pickRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const aliveRef = useRef(true);
  const resultUrlRef = useRef<string | null>(null);
  const originalUrlRef = useRef<string | null>(null);
  const carryPhoto = useRef<PhotoSettings | null>(null);
  const carryVideo = useRef<VideoSettings | null>(null);

  const current = queue[index] ?? null;
  const photoCaps = useMemo(() => probePhotoCaps(), []);

  /** Every object URL created here is revoked here — on file change and on unmount. */
  const revokeResult = useCallback(() => {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    resultUrlRef.current = null;
  }, []);
  const revokeOriginal = useCallback(() => {
    if (originalUrlRef.current) URL.revokeObjectURL(originalUrlRef.current);
    originalUrlRef.current = null;
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      abortRef.current?.abort();
      revokeResult();
      revokeOriginal();
    };
  }, [revokeResult, revokeOriginal]);

  const dropResult = useCallback(() => {
    revokeResult();
    setResult(null);
    setConfirmed(false);
    setCompare("original");
    setPhase((p) => (p === "done" ? "idle" : p));
  }, [revokeResult]);

  // ---- per-item initialization -------------------------------------------
  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    dropResult();
    setError(null);
    setPhase("idle");
    setProgress(0);
    // Stale metadata of the PREVIOUS source must never linger, not even for one frame.
    setPhotoSource(null);
    setPhoto(null);
    setMeta(null);
    setVideo(null);
    setAnalyzing(true);
    revokeOriginal();
    const url = URL.createObjectURL(current.file);
    originalUrlRef.current = url;
    setOriginalUrl(url);


    (async () => {
      if (current.kind === "photo") {
        try {
          const img = await loadImageElement(current.file);
          if (cancelled || !aliveRef.current) return;
          const src = {
            width: img.naturalWidth,
            height: img.naturalHeight,
            hasAlpha: mayHaveAlpha(current.file.type, current.file.name),
          };
          setPhotoSource(src);
          setPhoto(carryPhoto.current ?? smartPhotoPreset({ ...src, mime: current.file.type }, photoCaps));
        } catch {
          if (!cancelled) setError(L("processFailed"));
        } finally {
          if (!cancelled && aliveRef.current) setAnalyzing(false);
        }
        return;
      }
      if (current.file.size > MAX_CONVERT_BYTES) {
        // Handing this to ffmpeg.wasm would simply crash the tab — refuse up front.
        setError(L("tooBigEngine", { m: Math.round(MAX_CONVERT_BYTES / (1024 * 1024)) }));
        setAnalyzing(false);
        return;
      }
      try {
        const engine = await import("@/lib/video-ffmpeg");
        if (!engine.isConverterSupported()) throw new Error(L("notSupported"));
        const m = await engine.probeVideoMeta(current.file);
        const c = await engine.probeEncoders();
        if (cancelled || !aliveRef.current) return;
        setMeta(m);
        setCaps(c);
        const next = carryVideo.current ?? defaultVideoSettings(m, c);
        if (!next) throw new Error(L("engineFailed"));
        setVideo(next);
      } catch (e) {
        if (!cancelled) setError(describeProcessError(e));
      } finally {
        if (!cancelled && aliveRef.current) setAnalyzing(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  if (!current) return null;

  /** The file the admin is actually editing right now — never the stored object's size. */
  const sourceSize = current.file.size;
  /** Stored target size: only for the replacement gate / media-guard compatibility. */
  const storedSize = current.replace?.size ?? current.file.size;
  const sourceLabel = current.picked ? L("selectedFile") : L("originalLabel");

  const videoTooBig = current.kind === "video" && current.file.size > MAX_CONVERT_BYTES;

  const updatePhoto = (patch: Partial<PhotoSettings>) => {
    dropResult();
    setPhoto((p) => (p ? { ...p, ...patch } : p));
  };
  const updateVideo = (patch: Partial<VideoSettings>) => {
    dropResult();
    setVideo((v) => (v ? { ...v, ...patch } : v));
  };

  const resetSettings = () => {
    dropResult();
    setError(null);
    if (current.kind === "photo" && photoSource) {
      setPhoto(smartPhotoPreset({ ...photoSource, mime: current.file.type }, photoCaps));
    } else if (meta && caps) {
      const next = defaultVideoSettings(meta, caps);
      if (next) setVideo(next);
    }
  };

  /**
   * ffmpeg.wasm rejects with bare strings; video-ffmpeg wraps them into a VideoEngineError
   * carrying a category, so the admin gets an actionable sentence instead of "Processing failed".
   * The raw technical text (RuntimeError, exit codes) is logged by the engine, never shown.
   */
  const describeProcessError = (e: unknown): string => {
    const err = e as { name?: string; code?: string; message?: string } | null;
    if (err?.name === "VideoEngineError") {
      switch (err.code) {
        case "load": return L("errEngineLoad");
        case "read": return L("errRead");
        case "encode": return L("errEncode");
        case "output": return L("errOutput");
        case "memory": return L("errMemory");
        case "busy": return L("errBusy");
      }
    }
    if (err?.name === "UploadClientError") return L("errUploadClient");
    // Anything else is an internal/minified failure: the technical text belongs in the
    // console, the admin gets a localized sentence.
    console.error("[media] processing failed", e);
    return L("processFailed");
  };

  const runProcess = async () => {
    // Hard guard against a double click / second run on the shared wasm heap.
    if (phase === "processing" || phase === "applying") return;
    setError(null);
    setMemoryFallback(null);
    setProgress(0);
    setPhase("processing");
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const baseName = current.replace?.name ?? current.file.name;
      if (current.kind === "photo") {
        if (!photo) throw new Error(L("processFailed"));
        const out = await encodePhoto(current.file, photo);
        if (!aliveRef.current) return;
        revokeResult();
        const url = URL.createObjectURL(out.blob);
        resultUrlRef.current = url;
        setResult({
          blob: out.blob, size: out.size, url, name: photoOutputName(baseName, out.format),
          contentType: out.mime, format: out.format.toUpperCase(), width: out.width, height: out.height,
        });
      } else if (mode === "original") {
        // No conversion at all. Either the untouched File, or a stream-copy remux that
        // only drops the audio/subtitle/data streams — the video bitstream is copied.
        const name = current.replace?.name ?? current.file.name;
        const contentType = originalContentType(current.file.name, current.file.type);
        let blob: Blob = current.file;
        let hadAudio: boolean | undefined;
        if (stripAudioOnly) {
          if (!canRemuxWithoutReencode(current.file.name)) throw new Error(L("errRemuxUnsupported"));
          const engine = await import("@/lib/video-ffmpeg");
          if (!engine.isConverterSupported()) throw new Error(L("notSupported"));
          const out = await engine.stripAudio(
            current.file,
            { fileName: current.file.name, mimeType: contentType },
            {
              signal: controller.signal,
              onProgress: (r) => aliveRef.current && setProgress(Math.round(r * 100)),
            },
          );
          blob = out.blob;
          hadAudio = out.hadAudio;
        }
        if (!aliveRef.current) return;
        revokeResult();
        const url = URL.createObjectURL(blob);
        resultUrlRef.current = url;
        setResult({
          blob, size: blob.size, url, name, contentType,
          format: (current.file.name.split(".").pop() ?? "").toUpperCase(),
          width: meta?.width ?? 0, height: meta?.height ?? 0,
          passthrough: stripAudioOnly ? "muted" : "original",
          hadAudio,
        });
      } else {

        if (!video || !meta || !caps) throw new Error(L("processFailed"));
        const engine = await import("@/lib/video-ffmpeg");
        const out = await engine.convertVideo(
          current.file,
          {
            format: video.format,
            quality: "balanced",
            resolution: video.resolution,
            customShortSide: video.customShortSide,
            fps: video.fps,
            speed: video.speed,
            rate: video.rate,
            removeAudio: video.removeAudio,
            audioKbps: video.audioKbps,
            meta,
            caps,
          },
          {
            signal: controller.signal,
            onProgress: (p: { ratio: number }) => aliveRef.current && setProgress(Math.round(p.ratio * 100)),
          },
        );
        if (!aliveRef.current) return;
        const dims = targetDimensions(meta.width, meta.height, video.resolution, video.customShortSide);
        revokeResult();
        const url = URL.createObjectURL(out.blob);
        resultUrlRef.current = url;
        setResult({
          blob: out.blob, size: out.blob.size, url, name: outputNameFor(baseName, video.format),
          contentType: MIME_BY_FORMAT[video.format], format: video.format.toUpperCase(),
          width: dims.width, height: dims.height,
        });
      }
      setConfirmed(false);
      setCompare("result");
      setPhase("done");
    } catch (e) {
      if (!aliveRef.current) return;
      setPhase("idle");
      if ((e as DOMException)?.name === "AbortError") return;
      setError(describeProcessError(e));
      // Out of memory is a device limit, not a bad file: offer a lighter preset the admin
      // can accept explicitly. Nothing is changed until they click it.
      if ((e as { code?: string })?.code === "memory" && current.kind === "video" && caps) {
        setMemoryFallback(memorySafeSettings(caps));
      }
    } finally {

      abortRef.current = null;
    }
  };

  const evaluate = (base: number, out: number) =>
    current.kind === "photo" ? evaluatePhotoSaving(base, out) : evaluateVideoSaving(base, out);

  // Processing verdict: an honest comparison of the SELECTED source with the Result.
  const verdict = result ? evaluate(sourceSize, result.size) : null;
  const bigger = !!verdict && !verdict.ok && verdict.savedBytes <= 0;


  // Replacement is additionally gated by what the DEPLOYED media-guard really accepts
  // (container policy + gallery guard). The saving threshold is not a gate any more.
  const gate: import("@/lib/media-backend").ReplaceGate = result && current.replace
    ? replaceGate({
        kind: current.kind,
        outputName: result.name,

        publishedInGallery: current.replace.publishedInGallery,
      })
    : { allowed: true };
  const blockedReason = "reason" in gate ? gate.reason : null;
  // Manual replacement is deployed: the saving threshold is informational only and never
  // blocks an admin-confirmed replace. Real safety (auth, MIME, magic bytes, size,
  // transactional reference rewrite, gallery guard) stays server-side.
  const applyDisabled = !!blockedReason;


  const advanceQueue = () => {
    dropResult();
    if (index + 1 < queue.length) setIndex(index + 1);
    else onClose();
  };

  const skipCurrent = () => {
    abortRef.current?.abort();
    advanceQueue();
  };

  const keepOriginal = () => {
    // Local-only discard: the stored object was never touched.
    dropResult();
    toast.info(L("keptOriginal"));
  };

  const applyResult = async () => {
    if (!result || applyDisabled) return;
    
    setPhase("applying");
    setProgress(0);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    let staged: string | null = null;
    try {
      if (current.replace) {
        if (current.kind === "photo") {
          const res = await replaceMediaFile({
            fileName: current.replace.name,
            newName: result.name,
            contentBase64: await blobToBase64(result.blob),
            contentType: result.contentType,
            originalSize: current.replace.size,
            mode: "manual",

          });
          onApplied(res.newName ?? result.name, current.replace.name);
        } else {
          staged = await stagedObjectName(result.name.split(".").pop() ?? "mp4");
          await uploadResumable(staged, result.blob, result.contentType, {
            signal: controller.signal,
            onProgress: (sent, total) => aliveRef.current && setProgress(total ? Math.round((sent / total) * 100) : 0),
          });
          const res = await commitVideoReplacement({
            fileName: current.replace.name,
            stagedName: staged,
            newName: result.name,
            contentType: result.contentType,
            enforceSaving: false,
            mode: "manual",

          });
          onApplied(res.newName ?? result.name, current.replace.name);
        }
      } else {
        // Brand new object: a plain, safe Storage upload — only after Apply.
        // Names applied earlier in THIS queue are not in `existingNames` yet.
        const name = collisionSafeName(result.name, [...existingNames, ...appliedNames.current]);
        if (current.kind === "photo") {
          const { error: upError } = await supabase.storage.from("media").upload(name, result.blob, {
            contentType: result.contentType,
            cacheControl: "3600",
            upsert: false,
          });
          if (upError) throw new Error(upError.message);
        } else {
          await uploadResumable(name, result.blob, result.contentType, {
            signal: controller.signal,
            onProgress: (sent, total) => aliveRef.current && setProgress(total ? Math.round((sent / total) * 100) : 0),
          });
        }
        appliedNames.current.push(name);
        onApplied(name);
      }
      if (!aliveRef.current) return;
      // The library owns the success toast (onApplied) — no duplicate here.
      if (reuseSettings) {
        if (current.kind === "photo" && photo) carryPhoto.current = photo;
        if (current.kind === "video" && video) carryVideo.current = video;
      }
      advanceQueue();
    } catch (e) {
      if (staged) await removeObject(staged);
      if (!aliveRef.current) return;
      setPhase("done");
      if ((e as DOMException)?.name === "AbortError") return;
      setError(describeProcessError(e));
    } finally {
      abortRef.current = null;
    }
  };

  /**
   * Swap the local source file of an existing object. Nothing is uploaded: the new file
   * goes through the very same preview → Process → Replace original flow.
   */
  const onPickReplacement = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Always clear the input so picking the same file twice fires change again.
    e.target.value = "";
    if (!file || !current.replace) return;
    const verdict = classifyUpload(file);
    if (!verdict.ok) {
      toast.error(L("skippedUnsupported", { f: file.name }));
      return;
    }
    if (verdict.kind !== current.kind) {
      toast.error(L(current.kind === "photo" ? "kindMismatchPhoto" : "kindMismatchVideo", { f: file.name }));
      return;
    }
    if (verdict.kind === "video" && file.size > MAX_CONVERT_BYTES) {
      toast.error(L("tooBig", { f: file.name, m: Math.round(MAX_CONVERT_BYTES / (1024 * 1024)) }));
      return;
    }
    // A new id re-runs the per-item initialization: stale result/settings/progress/error
    // and the old object URLs are dropped there.
    abortRef.current?.abort();
    setQueue((q) =>
      q.map((it, i) =>
        i === index ? { ...it, id: `${it.id}#${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, file, picked: true } : it,
      ),
    );
  };

  const busy = phase === "processing" || phase === "applying";
  const photoFormats = availablePhotoFormats(photoCaps);
  const videoFormats = caps ? availableFormatsWithMov(caps) : [];
  const photoDims = photo && photoSource
    ? photoTargetDimensions(photoSource.width, photoSource.height, photo.size, photo.customSize)
    : null;
  const canProcess = !busy && (mode === "original"
    ? current.kind === "video"
    : !videoTooBig && (current.kind === "photo" ? !!photo : !!video));


  const panelClass = (side: "original" | "result") =>
    `rounded-lg border border-border p-3 space-y-2 ${compare === side ? "" : "hidden sm:block"}`;

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="break-all">
            {current.replace ? L("processReplaceTitle", { n: current.replace.name }) : L("processTitle")}
          </DialogTitle>
          <DialogDescription>{L("processDesc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground break-all">
            {L("queuePosition", { i: index + 1, t: queue.length })} · {current.file.name} · {formatFileSize(sourceSize)}
            {meta ? ` · ${meta.width}×${meta.height} · ${formatDuration(meta.duration)}` : ""}
            {photoSource ? ` · ${photoSource.width}×${photoSource.height}` : ""}
            {analyzing && !photoSource && !meta ? ` · ${L("analyzingFile")}` : ""}
          </p>
          {current.replace && (
            <p className="text-xs text-muted-foreground break-all">
              {L("willReplace", { n: current.replace.name })} · {formatFileSize(storedSize)}
            </p>
          )}


          <Tabs value={mode} onValueChange={(v) => { dropResult(); setMode(v as Mode); }}>
            <TabsList>
              <TabsTrigger value="smart">{L("modeSmart")}</TabsTrigger>
              <TabsTrigger value="advanced">{L("modeAdvanced")}</TabsTrigger>
              {current.kind === "video" && (
                <TabsTrigger value="original">{L("modeOriginal")}</TabsTrigger>
              )}
            </TabsList>
          </Tabs>

          {mode === "original" && current.kind === "video" && (
            <div className="rounded-lg border border-border p-3 space-y-3">
              <div>
                <p className="text-sm font-medium">{L("originalModeTitle")}</p>
                <p className="text-xs text-muted-foreground">{L("originalModeDesc")}</p>
              </div>
              <div className="flex items-start justify-between gap-3">
                <Label htmlFor="strip-audio-only" className="text-xs leading-snug">
                  {L("removeAudioOpt")}
                  <span className="block text-muted-foreground font-normal">{L("stripAudioHint")}</span>
                </Label>
                <Switch
                  id="strip-audio-only"
                  checked={stripAudioOnly}
                  disabled={busy}
                  onCheckedChange={(v) => { dropResult(); setStripAudioOnly(v); }}
                />
              </div>
            </div>
          )}

          {error && (

            <p role="alert" className="flex items-start gap-2 text-xs text-destructive">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}

          {memoryFallback && video && (
            <div className="text-xs border border-border rounded-lg p-3 space-y-2">
              <p>
                {L("memoryFallbackOffer", {
                  f: memoryFallback.format.toUpperCase(),
                  s: String(memoryFallback.customShortSide),
                })}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  updateVideo({
                    format: memoryFallback.format,
                    resolution: memoryFallback.resolution,
                    customShortSide: memoryFallback.customShortSide,
                    rate: video.rate.mode === "crf"
                      ? { mode: "crf", crf: defaultCrf(memoryFallback.format) }
                      : video.rate,
                  });
                  setMemoryFallback(null);
                  setError(null);
                }}
              >
                {L("memoryFallbackApply")}
              </Button>
            </div>
          )}

          {mode !== "original" && current.kind === "video" && !videoTooBig && current.file.size > MEMORY_WARN_BYTES && (
            <p className="text-xs text-muted-foreground border border-border rounded-lg p-3">{L("memoryWarning")}</p>
          )}

          {mode !== "original" && current.kind === "video" && video && meta && !videoTooBig && (() => {
            const dims = targetDimensions(meta.width, meta.height, video.resolution, video.customShortSide);
            if (!exceedsMemoryBudget({ ...dims, format: video.format, mobile: isMobileBrowser() })) return null;
            return (
              <p className="text-xs text-muted-foreground border border-border rounded-lg p-3">
                {L("memoryBudgetWarn", {
                  f: video.format.toUpperCase(),
                  w: String(dims.width),
                  h: String(dims.height),
                })}
              </p>
            );
          })()}


          {/* ---- photo controls -------------------------------------- */}
          {current.kind === "photo" && photo && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="mp-format" className="text-xs">{L("format")}</Label>
                  <Select
                    value={photo.format}
                    onValueChange={(v) => updatePhoto({ format: v as PhotoFormat })}
                    disabled={busy || mode === "smart"}
                  >
                    <SelectTrigger id="mp-format"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {photoFormats.map((f) => <SelectItem key={f} value={f}>{f.toUpperCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mp-size" className="text-xs">{L("sizeLimit")}</Label>
                  <Select
                    value={photo.size}
                    onValueChange={(v) => updatePhoto({ size: v as SizeChoice })}
                    disabled={busy || mode === "smart"}
                  >
                    <SelectTrigger id="mp-size"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SIZES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s === "original" ? L("original") : s === "custom" ? L("customSize") : `${s} px`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {mode === "advanced" && photo.size === "custom" && (
                <div className="space-y-1.5">
                  <Label htmlFor="mp-custom" className="text-xs">{L("customSize")}</Label>
                  <Input
                    id="mp-custom" type="number" min={64} max={8000} value={photo.customSize}
                    onChange={(e) => updatePhoto({ customSize: Number(e.target.value) })} disabled={busy}
                  />
                </div>
              )}

              {mode === "advanced" && (
                supportsQuality(photo.format) ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="mp-quality" className="text-xs">{L("quality")}</Label>
                    <div className="flex items-center gap-3">
                      <Slider
                        id="mp-quality" aria-label={L("quality")} min={MIN_QUALITY} max={MAX_QUALITY} step={1}
                        value={[photo.quality]} onValueChange={([v]) => updatePhoto({ quality: clampQuality(v) })}
                        disabled={busy} className="flex-1"
                      />
                      <Input
                        type="number" aria-label={`${L("quality")} %`} min={MIN_QUALITY} max={MAX_QUALITY}
                        value={photo.quality} onChange={(e) => updatePhoto({ quality: clampQuality(e.target.value) })}
                        disabled={busy} className="w-20"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{L("pngLossless")}</p>
                )
              )}

              {photoSource && willFlattenAlpha(photo, { ...photoSource, mime: current.file.type }) && (
                <div className="space-y-1.5 rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">{L("alphaWarning")}</p>
                  <Label htmlFor="mp-bg" className="text-xs">{L("background")}</Label>
                  <Input
                    id="mp-bg" type="color" value={photo.background || DEFAULT_BACKGROUND}
                    onChange={(e) => updatePhoto({ background: e.target.value })} disabled={busy}
                    className="h-9 w-20 p-1"
                  />
                </div>
              )}

              {photoDims && (
                <p className="text-xs text-muted-foreground break-all">
                  {photoOutputName(current.replace?.name ?? current.file.name, photo.format)} ·{" "}
                  {photoDims.width}×{photoDims.height} — {L("noUpscalePhoto")}
                </p>
              )}
            </div>
          )}

          {/* ---- video controls -------------------------------------- */}
          {mode !== "original" && current.kind === "video" && video && caps && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="mv-format" className="text-xs">{L("format")}</Label>
                  <Select
                    value={video.format}
                    onValueChange={(v) => updateVideo({ format: v as VideoFormat, rate: { mode: "crf", crf: defaultCrf(v as VideoFormat) } })}
                    disabled={busy || mode === "smart"}
                  >
                    <SelectTrigger id="mv-format"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {videoFormats.map((f) => <SelectItem key={f} value={f}>{f.toUpperCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mv-res" className="text-xs">{L("resolution")}</Label>
                  <Select
                    value={video.resolution}
                    onValueChange={(v) => updateVideo({ resolution: v as ResolutionChoice })}
                    disabled={busy || mode === "smart"}
                  >
                    <SelectTrigger id="mv-res"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RESOLUTIONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r === "original" ? L("original") : r === "custom" ? L("customSize") : `${r}p`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mv-fps" className="text-xs">{L("fps")}</Label>
                  <Select
                    value={video.fps}
                    onValueChange={(v) => updateVideo({ fps: v as FpsChoice })}
                    disabled={busy || mode === "smart"}
                  >
                    <SelectTrigger id="mv-fps"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FPS_CHOICES.map((f) => (
                        <SelectItem key={f} value={f}>{f === "original" ? L("original") : f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!isWebFormat(video.format) && (
                <p className="text-xs text-muted-foreground border border-border rounded-lg p-3">{L("movNotRecommended")}</p>
              )}

              {mode === "advanced" && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="mv-speed" className="text-xs">{L("speed")}</Label>
                    <Select value={video.speed} onValueChange={(v) => updateVideo({ speed: v as SpeedChoice })} disabled={busy}>
                      <SelectTrigger id="mv-speed"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fast">{L("speedFast")}</SelectItem>
                        <SelectItem value="balanced">{L("speedBalanced")}</SelectItem>
                        <SelectItem value="max">{L("speedMax")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="mv-rate" className="text-xs">{L("rateControl")}</Label>
                    <Select
                      value={video.rate.mode}
                      onValueChange={(v) =>
                        updateVideo({
                          rate: v === "crf" ? { mode: "crf", crf: defaultCrf(video.format) } : { mode: "bitrate", kbps: 2500 },
                        })
                      }
                      disabled={busy}
                    >
                      <SelectTrigger id="mv-rate"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="crf">{L("rateCrf")}</SelectItem>
                        <SelectItem value="bitrate">{L("rateBitrate")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {video.rate.mode === "crf" ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="mv-crf" className="text-xs">CRF</Label>
                      <div className="flex items-center gap-3">
                        <Slider
                          id="mv-crf" aria-label="CRF"
                          min={CRF_RANGE[video.format].min} max={CRF_RANGE[video.format].max} step={1}
                          value={[video.rate.crf]}
                          onValueChange={([v]) => updateVideo({ rate: { mode: "crf", crf: clampCrf(video.format, v) } })}
                          disabled={busy} className="flex-1"
                        />
                        <Input
                          type="number" aria-label="CRF"
                          min={CRF_RANGE[video.format].min} max={CRF_RANGE[video.format].max}
                          value={video.rate.crf}
                          onChange={(e) => updateVideo({ rate: { mode: "crf", crf: clampCrf(video.format, e.target.value) } })}
                          disabled={busy} className="w-20"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">{L("crfHint")}</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label htmlFor="mv-kbps" className="text-xs">{L("bitrateKbps")}</Label>
                      <Input
                        id="mv-kbps" type="number" min={150} max={20000} value={video.rate.kbps}
                        onChange={(e) => updateVideo({ rate: { mode: "bitrate", kbps: clampBitrate(e.target.value) } })}
                        disabled={busy}
                      />
                      {meta && (
                        <p className="text-xs text-muted-foreground">
                          {L("estimatedSize", {
                            s: formatFileSize(
                              estimateSizeBytes(video.rate.kbps, video.removeAudio ? 0 : video.audioKbps, meta.duration),
                            ),
                          })}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <Switch
                      id="mv-mute" checked={video.removeAudio}
                      onCheckedChange={(v) => updateVideo({ removeAudio: Boolean(v) })} disabled={busy}
                    />
                    <Label htmlFor="mv-mute" className="text-sm cursor-pointer">{L("removeAudioOpt")}</Label>
                  </div>

                  {!video.removeAudio && (
                    <div className="space-y-1.5">
                      <Label htmlFor="mv-abr" className="text-xs">{L("audioBitrate")}</Label>
                      <Select
                        value={String(video.audioKbps)}
                        onValueChange={(v) => updateVideo({ audioKbps: Number(v) })}
                        disabled={busy}
                      >
                        <SelectTrigger id="mv-abr"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {AUDIO_KBPS_CHOICES.map((k) => <SelectItem key={k} value={String(k)}>{k} kbps</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {busy && (
            <div className="space-y-1.5">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground">
                {phase === "processing" ? L("processing", { p: progress }) : L("applying", { p: progress })}
              </p>
            </div>
          )}

          {/* ---- visual comparison BEFORE Apply ----------------------- */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 sm:hidden">
              <Button
                type="button" size="sm" variant={compare === "original" ? "default" : "outline"}
                onClick={() => setCompare("original")}
              >
                {sourceLabel}
              </Button>
              <Button
                type="button" size="sm" variant={compare === "result" ? "default" : "outline"}
                onClick={() => setCompare("result")} disabled={!result}
              >
                {L("showResult")}
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className={panelClass("original")}>
                <p className="text-foreground">{sourceLabel}</p>
                {originalUrl && (current.kind === "photo" ? (
                  <img key={originalUrl} src={originalUrl} alt={sourceLabel} className="w-full rounded-md object-contain max-h-56 bg-secondary" />
                ) : (
                  <VideoViewer
                    key={originalUrl}
                    src={originalUrl}
                    lang={viewerLang}
                    chromeY={520}
                    onSavePoster={
                      current.replace
                        ? async (frame) => {
                            try {
                              await saveLibraryPoster(current.replace!.name, frame.blob, frame.ext, frame.mimeType);
                              toast.success(L("posterSaved"));
                              return true;
                            } catch (err) {
                              console.warn("[library] poster save failed", err);
                              return false;
                            }
                          }
                        : undefined
                    }
                  />
                ))}
                <p className="text-muted-foreground break-all">
                  {current.file.name} · {formatFileSize(sourceSize)}
                  {photoSource ? ` · ${photoSource.width}×${photoSource.height}` : ""}
                  {meta ? ` · ${meta.width}×${meta.height} · ${formatDuration(meta.duration)}` : ""}
                  {analyzing && !photoSource && !meta ? ` · ${L("analyzingFile")}` : ""}
                </p>
              </div>

              <div className={panelClass("result")}>
                <p className="text-foreground">{L("resultLabel")}</p>
                {result ? (
                  <>
                    {current.kind === "photo" ? (
                      <img src={result.url} alt={L("resultLabel")} className="w-full rounded-md object-contain max-h-56 bg-secondary" />
                    ) : (
                      <video src={result.url} controls playsInline className="w-full rounded-md bg-black max-h-56" />
                    )}
                    <p className="text-muted-foreground break-all">
                      {formatFileSize(result.size)} · {result.format}
                      {result.width && result.height ? ` · ${result.width}×${result.height}` : ""}
                      {verdict?.ok && !result.passthrough ? ` · −${verdict.savedPercent}%` : ""}
                    </p>
                    {result.passthrough === "original" && (
                      <p className="text-muted-foreground">
                        {L("passthroughResult", { n: result.name, s: formatFileSize(result.size) })}
                      </p>
                    )}
                    {result.passthrough === "muted" && (
                      <p className="text-muted-foreground">
                        {result.hadAudio ? L("stripAudioResult") : L("stripAudioNoAudio")}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground">{L("notProcessed")}</p>
                )}
              </div>
            </div>
          </div>

          {result && !result.passthrough && verdict && !verdict.ok && (
            <p className="text-xs text-muted-foreground border border-border rounded-lg p-3">
              {bigger
                ? L("resultBigger", { a: formatFileSize(sourceSize), b: formatFileSize(result.size) })
                : L("resultMarginal", { a: formatFileSize(sourceSize), b: formatFileSize(result.size) })}
            </p>
          )}


          {blockedReason && (
            <p role="alert" className="text-xs text-destructive border border-destructive/40 rounded-lg p-3">
              {L(blockedReason)}
            </p>
          )}

          {current.replace && <p className="text-xs text-muted-foreground">{L("noRollback")}</p>}

          {queue.length > 1 && (
            <div className="flex items-center gap-3">
              <Switch id="mp-reuse" checked={reuseSettings} onCheckedChange={(v) => setReuseSettings(Boolean(v))} disabled={busy} />
              <Label htmlFor="mp-reuse" className="text-xs cursor-pointer">{L("applyToAll")}</Label>
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          {current.replace && (
            <>
              <input
                ref={pickRef}
                type="file"
                className="hidden"
                accept={current.kind === "photo" ? PHOTO_ACCEPT : VIDEO_ACCEPT}
                onChange={onPickReplacement}
                data-testid="replace-file-input"
              />
              <Button variant="outline" size="sm" onClick={() => pickRef.current?.click()} disabled={busy}>
                <Upload size={14} className="mr-1" />{L("replaceFile")}
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={() => (busy ? abortRef.current?.abort() : onClose())}>
            {L("cancel")}
          </Button>
          {queue.length > 1 && (
            <Button variant="ghost" size="sm" onClick={skipCurrent} disabled={busy}>{L("skipFile")}</Button>
          )}
          <Button variant="outline" size="sm" onClick={resetSettings} disabled={busy}>
            <RotateCcw size={14} className="mr-1" />{L("resetSettings")}
          </Button>
          {result && (
            <>
              <Button variant="outline" size="sm" onClick={keepOriginal} disabled={busy}>
                <Undo2 size={14} className="mr-1" />{L("keepOriginal")}
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a href={result.url} download={result.name}>
                  <Download size={14} className="mr-1" />{L("downloadResult")}
                </a>
              </Button>
            </>
          )}
          <Button size="sm" onClick={() => void runProcess()} disabled={!canProcess}>
            {phase === "processing" ? <Loader2 size={14} className="animate-spin mr-1" /> : <Wand2 size={14} className="mr-1" />}
            {L("process")}
          </Button>
          {result && (
            <Button size="sm" onClick={() => void applyResult()} disabled={busy || applyDisabled}>
              {phase === "applying" ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              {current.replace ? L("applyReplace") : L("apply")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MediaProcessingDialog;
