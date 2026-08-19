/**
 * Pure decision logic for the browser-side video converter.
 * Everything here is runtime-agnostic (no ffmpeg import) so the whole policy —
 * never upscale, even dimensions, codec availability, smart preset, saving threshold —
 * is unit-testable and can never diverge from what actually runs.
 */

export type VideoFormat = "mp4" | "mov" | "webm";
export type VideoQuality = "high" | "balanced" | "small";
export type ResolutionChoice = "original" | "1080" | "720" | "480" | "custom";
/** Frame-rate ceiling. A source below the choice keeps its own rate — never raised. */
export type FpsChoice = "original" | "30" | "25" | "24";
/** Real encoder effort: slower presets compress harder for the same quality target. */
export type SpeedChoice = "fast" | "balanced" | "max";


/** Hard ceiling for the local converter: bigger sources may only be uploaded as-is. */
export const MAX_CONVERT_BYTES = 250 * 1024 * 1024;
/** Above this the browser tab is likely to run out of memory during a wasm transcode. */
export const MEMORY_WARN_BYTES = 120 * 1024 * 1024;
/** Smart mode must save at least this much, mirroring the image thresholds. */
export const MIN_SAVING_RATIO = 0.1;
export const MIN_SAVING_BYTES = 10 * 1024;
/** Web-friendly frame-rate cap applied by the smart preset. */
export const FPS_CAP = 30;

export interface VideoMeta {
  width: number;
  height: number;
  duration: number;
  size: number;
  fps?: number;
}

/**
 * Encoders the loaded ffmpeg core actually reports (`ffmpeg -encoders`).
 * Every option offered by the UI is gated on these flags — we never emit an encoder name
 * that the running core cannot write.
 */
export interface EncoderCaps {
  h264: boolean;
  vp9: boolean;
  aac: boolean;
  opus: boolean;
  mp3lame: boolean;
  vorbis: boolean;
}

export const EXT_BY_FORMAT: Record<VideoFormat, string> = { mp4: "mp4", mov: "mov", webm: "webm" };
export const MIME_BY_FORMAT: Record<VideoFormat, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

/** MOV is a capture/editing container: valid in the Library, poor for the public web. */
export const WEB_FORMATS: VideoFormat[] = ["mp4", "webm"];
export const isWebFormat = (format: VideoFormat): boolean => WEB_FORMATS.includes(format);

/** Containers the public Gallery is allowed to publish (validation stays MP4/WebM only). */
export const GALLERY_PUBLISH_EXTS = ["mp4", "webm"] as const;
export const isGalleryPublishable = (fileName: string): boolean =>
  (GALLERY_PUBLISH_EXTS as readonly string[]).includes(
    (fileName.match(/\.([A-Za-z0-9]{2,5})$/)?.[1] ?? "").toLowerCase(),
  );

/** H.264 containers share the same video/audio encoder policy. */
const isH264Container = (format: VideoFormat) => format === "mp4" || format === "mov";

/**
 * The audio encoder actually used for a container, or null when the core has none for it.
 * A format with no audio encoder is never offered (see availableFormats), so in practice
 * this only returns null for capability combinations the UI already refuses.
 */
export function audioEncoderFor(format: VideoFormat, caps: EncoderCaps): string | null {
  if (isH264Container(format)) {
    if (caps.aac) return "aac";
    if (caps.mp3lame) return "libmp3lame";
    return null;
  }
  if (caps.opus) return "libopus";
  if (caps.vorbis) return "libvorbis";
  return null;
}

/**
 * Output policy: MP4 / H.264 + AAC is the ONLY container we produce.
 * libvpx-vp9 crashes the browser renderer in this wasm core even on a minimal argv and a
 * one-second clip, so WebM is never offered as a conversion target. Existing WebM files
 * stay untouched and WebM sources can still be read as input.
 */
export function availableFormats(caps: EncoderCaps): VideoFormat[] {
  const out: VideoFormat[] = [];
  if (caps.h264 && audioEncoderFor("mp4", caps)) out.push("mp4");
  return out;
}

/**
 * Every container the advanced dialog may write: MP4 plus MOV (same H.264 core).
 * WebM is deliberately absent — see availableFormats.
 */
export function availableFormatsWithMov(caps: EncoderCaps): VideoFormat[] {
  const out: VideoFormat[] = [];
  if (caps.h264 && audioEncoderFor("mp4", caps)) out.push("mp4", "mov");
  return out;
}





const evenDown = (n: number) => Math.max(2, Math.floor(n / 2) * 2);

/**
 * Target dimensions for a resolution choice.
 * - never upscales (a 480p source stays 480p even if 1080p is requested)
 * - preserves aspect ratio
 * - both dimensions are even (required by yuv420p)
 * The limit applies to the *short* side so portrait video is handled correctly.
 */
export function targetDimensions(
  width: number,
  height: number,
  choice: ResolutionChoice,
  customShortSide = 720,
): { width: number; height: number } {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  if (choice === "original") return { width: evenDown(w), height: evenDown(h) };
  const raw = choice === "custom" ? Number(customShortSide) : Number(choice);
  const limit = Number.isFinite(raw) ? Math.min(4320, Math.max(120, Math.round(raw))) : 720;
  const short = Math.min(w, h);
  if (short <= limit) return { width: evenDown(w), height: evenDown(h) };
  const scale = limit / short;
  return { width: evenDown(w * scale), height: evenDown(h * scale) };
}

const CRF: Record<VideoFormat, Record<VideoQuality, number>> = {
  mp4: { high: 20, balanced: 24, small: 28 },
  mov: { high: 20, balanced: 24, small: 28 },
  webm: { high: 30, balanced: 34, small: 38 },
};

const AUDIO_KBPS: Record<VideoQuality, number> = { high: 160, balanced: 128, small: 96 };

/** Format-aware CRF bounds. Lower = better quality and a bigger file. */
export const CRF_RANGE: Record<VideoFormat, { min: number; max: number }> = {
  mp4: { min: 14, max: 40 },
  mov: { min: 14, max: 40 },
  webm: { min: 20, max: 50 },
};

export const defaultCrf = (format: VideoFormat, quality: VideoQuality = "balanced"): number =>
  CRF[format][quality];

export function clampCrf(format: VideoFormat, value: unknown): number {
  const { min, max } = CRF_RANGE[format];
  const n = Number(value);
  if (!Number.isFinite(n)) return defaultCrf(format);
  return Math.min(max, Math.max(min, Math.round(n)));
}

export const MIN_VIDEO_KBPS = 150;
export const MAX_VIDEO_KBPS = 20000;

export function clampBitrate(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 2500;
  return Math.min(MAX_VIDEO_KBPS, Math.max(MIN_VIDEO_KBPS, Math.round(n)));
}

export const AUDIO_KBPS_CHOICES = [64, 96, 128, 160, 192] as const;

/** Rate control is EXCLUSIVE: CRF or target bitrate, never both in the same argv. */
export type RateControl =
  | { mode: "crf"; crf: number }
  | { mode: "bitrate"; kbps: number };

/** Estimated output bytes for a target bitrate, used by the size preview. */
export function estimateSizeBytes(videoKbps: number, audioKbps: number, durationSeconds: number): number {
  const d = Math.max(0, Number(durationSeconds) || 0);
  const total = Math.max(0, Number(videoKbps) || 0) + Math.max(0, Number(audioKbps) || 0);
  return Math.round((total * 1000 * d) / 8);
}

/** Effective frame-rate ceiling: the choice never raises the source rate. */
export function effectiveFps(choice: FpsChoice, sourceFps?: number): number | null {
  if (choice === "original") return sourceFps && sourceFps > 0 ? null : null;
  const wanted = Number(choice);
  if (sourceFps && sourceFps > 0 && sourceFps <= wanted) return null; // already lower — leave it
  return wanted;
}

const X264_PRESET: Record<SpeedChoice, string> = {
  fast: "veryfast",
  balanced: "medium",
  max: "slow",
};
/** libvpx-vp9 -cpu-used: lower = slower and better compressed. */
const VP9_CPU_USED: Record<SpeedChoice, string> = { fast: "5", balanced: "2", max: "1" };

export interface ConvertOptions {
  inputName: string;
  outputName: string;
  format: VideoFormat;
  quality: VideoQuality;
  resolution: ResolutionChoice;
  meta: Pick<VideoMeta, "width" | "height"> & { fps?: number };
  caps: EncoderCaps;
  fpsCap?: number;
  /** Advanced overrides — omitted entirely by the Smart preset. */
  customShortSide?: number;
  fps?: FpsChoice;
  speed?: SpeedChoice;
  rate?: RateControl;
  removeAudio?: boolean;
  audioKbps?: number;
}

/**
 * Builds the exact ffmpeg argv. Single-thread core, so no -threads juggling.
 * MP4/MOV always get +faststart (metadata first → starts playing while downloading).
 *
 * Rate control is mutually exclusive: in CRF mode no target `-b:v` is emitted, in bitrate
 * mode no `-crf` is emitted. (VP9's `-b:v 0` in CRF mode is the documented constant-quality
 * switch, not a target bitrate.)
 */
export function buildFfmpegArgs(o: ConvertOptions): string[] {
  const { width, height } = targetDimensions(o.meta.width, o.meta.height, o.resolution, o.customShortSide);
  const fpsChoice: FpsChoice | undefined = o.fps;
  const cap = fpsChoice
    ? effectiveFps(fpsChoice, o.meta.fps)
    : (o.fpsCap ?? FPS_CAP);
  // -fpsmax is a *ceiling*: a 24 fps source stays 24 fps instead of being interpolated up
  // to 30 (which -r would do, making the file bigger for no visual gain).
  const args = ["-i", o.inputName, "-vf", `scale=${width}:${height}`];
  if (cap !== null) args.push("-fpsmax", String(cap));
  const audio = o.removeAudio ? null : audioEncoderFor(o.format, o.caps);
  const rate: RateControl = o.rate ?? { mode: "crf", crf: CRF[o.format][o.quality] };
  const speed: SpeedChoice = o.speed ?? "fast";

  if (o.format === "mp4" || o.format === "mov") {
    args.push("-c:v", "libx264", "-preset", X264_PRESET[speed]);
    if (rate.mode === "crf") args.push("-crf", String(clampCrf(o.format, rate.crf)));
    else args.push("-b:v", `${clampBitrate(rate.kbps)}k`);
    // Single-thread wasm core: one slice, a short lookahead and no B-frame pyramid keep
    // x264's frame buffers inside the 32-bit heap that mobile Safari caps hard.
    args.push("-threads", "1", "-rc-lookahead", "10", "-pix_fmt", "yuv420p", "-movflags", "+faststart");
    if (o.format === "mov") args.push("-f", "mov");
  } else {
    args.push("-c:v", "libvpx-vp9", "-cpu-used", VP9_CPU_USED[speed]);
    if (rate.mode === "crf") args.push("-b:v", "0", "-crf", String(clampCrf(o.format, rate.crf)));
    else args.push("-b:v", `${clampBitrate(rate.kbps)}k`);
    // libvpx is the memory hog: alt-ref + a 25-frame lookahead holds ~25 raw 1080x1920
    // frames (~75 MB) on top of the tile/row-mt worker contexts, which is exactly what
    // blows up as "Out of bounds memory access" on iOS. None of it helps a 1-thread core.
    args.push(
      "-threads", "1",
      "-row-mt", "0",
      "-tile-columns", "0",
      "-frame-parallel", "0",
      "-lag-in-frames", "0",
      "-auto-alt-ref", "0",
      "-deadline", "good",
      "-pix_fmt", "yuv420p",
    );
  }

  // Never name an encoder this core did not report; drop the audio track instead.
  if (audio) args.push("-c:a", audio, "-b:a", `${o.audioKbps ?? AUDIO_KBPS[o.quality]}k`);
  else args.push("-an");

  args.push("-y", o.outputName);
  return args;

}

// ---------------------------------------------------------------------------
// Memory budget (mobile Safari / iOS)
// ---------------------------------------------------------------------------

/**
 * The wasm core is a 32-bit build: its whole heap (source bytes + decoded frames + encoder
 * state + output) must fit in one linear memory that iOS Safari refuses to grow much past
 * a few hundred MB. VP9 needs far more working memory per pixel than x264, so the two
 * containers get different ceilings.
 */
export const MOBILE_WEBM_PIXEL_BUDGET = 1280 * 720;
export const MOBILE_H264_PIXEL_BUDGET = 1920 * 1080;

/** Heuristic, non-blocking: only used to warn and to offer an explicit safer preset. */
export const isMobileBrowser = (ua = typeof navigator === "undefined" ? "" : navigator.userAgent): boolean =>
  /iPhone|iPad|iPod|Android/i.test(ua) ||
  // iPadOS 13+ reports a desktop UA but is still the mobile memory budget.
  (/Macintosh/.test(ua) && typeof navigator !== "undefined" && (navigator as { maxTouchPoints?: number }).maxTouchPoints > 1);

/** True when the requested output is likely to exhaust the wasm heap on this device. */
export function exceedsMemoryBudget(o: {
  width: number;
  height: number;
  format: VideoFormat;
  mobile: boolean;
}): boolean {
  if (!o.mobile) return false;
  const pixels = Math.max(0, o.width) * Math.max(0, o.height);
  const budget = o.format === "webm" ? MOBILE_WEBM_PIXEL_BUDGET : MOBILE_H264_PIXEL_BUDGET;
  return pixels > budget;
}

/**
 * The explicit, user-confirmed fallback offered after (or instead of) an out-of-memory
 * failure: H.264/MP4 at 720p short side. Never applied silently.
 */
export function memorySafeSettings(caps: EncoderCaps): {
  format: VideoFormat;
  resolution: ResolutionChoice;
  customShortSide: number;
} | null {
  const formats = availableFormatsWithMov(caps);
  const format: VideoFormat | undefined = formats.includes("mp4") ? "mp4" : undefined;
  if (!format) return null;
  return { format, resolution: "720", customShortSide: 720 };
}


/**
 * Smart preset: always MP4 / H.264 + AAC, max 1080p, capped fps, quality by source bitrate.
 * Returns null when the core cannot encode H.264 at all.
 */
export function smartPreset(
  meta: VideoMeta,
  caps: EncoderCaps,
): { format: VideoFormat; resolution: ResolutionChoice; quality: VideoQuality } | null {
  const formats = availableFormats(caps);
  if (!formats.includes("mp4")) return null;
  const format: VideoFormat = "mp4";

  const short = Math.min(meta.width, meta.height);
  const resolution: ResolutionChoice = short > 1080 ? "1080" : "original";
  const perSecond = meta.duration > 0 ? meta.size / meta.duration : 0;
  // > ~1.5 MB/s of source is clearly unoptimized footage → push harder.
  const quality: VideoQuality = perSecond > 1.5 * 1024 * 1024 ? "small" : "balanced";
  return { format, resolution, quality };
}

export type VideoSavingVerdict =
  | { ok: true; savedBytes: number; savedPercent: number }
  | { ok: false; reason: "notSmaller" | "alreadyOptimized"; savedBytes: number };

/** Same 10% / 10 KB contract as image compression, evaluated on real byte sizes. */
export function evaluateVideoSaving(originalSize: number, newSize: number): VideoSavingVerdict {
  const saved = originalSize - newSize;
  if (saved <= 0) return { ok: false, reason: "notSmaller", savedBytes: saved };
  if (saved < MIN_SAVING_BYTES || saved / originalSize < MIN_SAVING_RATIO) {
    return { ok: false, reason: "alreadyOptimized", savedBytes: saved };
  }
  return { ok: true, savedBytes: saved, savedPercent: Math.round((saved / originalSize) * 100) };
}

/** Output filename derived from the source basename + the produced container. */
export function outputNameFor(sourceName: string, format: VideoFormat): string {
  const base = sourceName.replace(/\.[^.]+$/, "") || "video";
  return `${base}.${EXT_BY_FORMAT[format]}`;
}

// ---------------------------------------------------------------------------
// Audio removal (mute) — lossless remux, never a re-encode
// ---------------------------------------------------------------------------

/**
 * Containers whose muxer understands `-movflags +faststart`. WebM must not get it.
 */
const MOV_LIKE = new Set(["mp4", "m4v", "mov"]);

/**
 * Explicit output muxer per extension. Critical for `.m4v`, which ffmpeg otherwise
 * resolves to the *raw* MPEG-4 video muxer instead of the ISO BMFF/MP4 container.
 */
const MUXER_BY_EXT: Record<string, string> = {
  mp4: "mp4",
  m4v: "mp4",
  mov: "mov",
  webm: "webm",
};

/**
 * argv for stripping every audio (and data/subtitle) stream while copying the video
 * bitstream untouched. No `-c:v` re-encode → no quality loss and near-instant remux.
 * The container/extension is preserved, so the resulting MIME stays valid.
 */
export function buildStripAudioArgs(o: { inputName: string; outputName: string }): string[] {
  const ext = (o.outputName.match(/\.([A-Za-z0-9]{2,5})$/)?.[1] ?? "").toLowerCase();
  const args = ["-i", o.inputName, "-map", "0:v:0", "-c:v", "copy", "-an", "-sn", "-dn"];
  if (MOV_LIKE.has(ext)) args.push("-movflags", "+faststart");
  const muxer = MUXER_BY_EXT[ext];
  if (muxer) args.push("-f", muxer);
  args.push("-y", o.outputName);
  return args;
}

// ---------------------------------------------------------------------------
// Upload the original, unconverted file
// ---------------------------------------------------------------------------

/** Lowercase extension of a file name, or "" when it has none. */
export const extOf = (fileName: string): string =>
  (fileName.match(/\.([A-Za-z0-9]{2,5})$/)?.[1] ?? "").toLowerCase();

/** Containers whose audio track can be dropped by a safe stream-copy remux. */
export const REMUXABLE_VIDEO_EXTS = Object.keys(MUXER_BY_EXT);
export const canRemuxWithoutReencode = (fileName: string): boolean =>
  REMUXABLE_VIDEO_EXTS.includes(extOf(fileName));

const MIME_BY_EXT: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

/**
 * MIME of an untouched original: the browser-reported type wins, the extension is only a
 * fallback for files a browser hands over with an empty type.
 */
export const originalContentType = (fileName: string, fileType?: string): string =>
  fileType || MIME_BY_EXT[extOf(fileName)] || "application/octet-stream";




/**
 * True when the ffmpeg log for the source shows at least one audio stream.
 * Used only for an honest "this video had no audio" notice — never to skip the remux
 * (the remux is what guarantees no audio can reach storage).
 */
export function logHasAudioStream(log: string): boolean {
  return /Stream #\d+:\d+(?:\[[^\]]*\])?(?:\([^)]*\))?:\s*Audio:/i.test(log);
}


/** Parses `ffmpeg -encoders` output into the capability flags we gate options on. */
export function parseEncoderCaps(log: string): EncoderCaps {
  const has = (name: string) => new RegExp(`^\\s*\\S+\\s+${name}\\s`, "m").test(log);
  return {
    h264: has("libx264"),
    vp9: has("libvpx-vp9"),
    aac: has("aac"),
    opus: has("libopus"),
    mp3lame: has("libmp3lame"),
    vorbis: has("libvorbis"),
  };
}


export const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
};
