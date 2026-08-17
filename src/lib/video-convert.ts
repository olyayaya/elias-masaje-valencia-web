/**
 * Pure decision logic for the browser-side video converter.
 * Everything here is runtime-agnostic (no ffmpeg import) so the whole policy —
 * never upscale, even dimensions, codec availability, smart preset, saving threshold —
 * is unit-testable and can never diverge from what actually runs.
 */

export type VideoFormat = "mp4" | "webm";
export type VideoQuality = "high" | "balanced" | "small";
export type ResolutionChoice = "original" | "1080" | "720" | "480";

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

export const EXT_BY_FORMAT: Record<VideoFormat, string> = { mp4: "mp4", webm: "webm" };
export const MIME_BY_FORMAT: Record<VideoFormat, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
};

/**
 * The audio encoder actually used for a container, or null when the core has none for it.
 * A format with no audio encoder is never offered (see availableFormats), so in practice
 * this only returns null for capability combinations the UI already refuses.
 */
export function audioEncoderFor(format: VideoFormat, caps: EncoderCaps): string | null {
  if (format === "mp4") {
    if (caps.aac) return "aac";
    if (caps.mp3lame) return "libmp3lame";
    return null;
  }
  if (caps.opus) return "libopus";
  if (caps.vorbis) return "libvorbis";
  return null;
}

/**
 * A format is offerable only when this core can write BOTH its video and a matching audio
 * codec. Optimizing a video must never silently drop the soundtrack, so a container we
 * could only produce muted is not an option at all:
 *   MP4  → libx264   + (aac | libmp3lame)
 *   WebM → libvpx-vp9 + (libopus | libvorbis)
 */
export function availableFormats(caps: EncoderCaps): VideoFormat[] {
  const out: VideoFormat[] = [];
  if (caps.h264 && audioEncoderFor("mp4", caps)) out.push("mp4");
  if (caps.vp9 && audioEncoderFor("webm", caps)) out.push("webm");
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
): { width: number; height: number } {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  if (choice === "original") return { width: evenDown(w), height: evenDown(h) };
  const limit = Number(choice);
  const short = Math.min(w, h);
  if (short <= limit) return { width: evenDown(w), height: evenDown(h) };
  const scale = limit / short;
  return { width: evenDown(w * scale), height: evenDown(h * scale) };
}

const CRF: Record<VideoFormat, Record<VideoQuality, number>> = {
  mp4: { high: 20, balanced: 24, small: 28 },
  webm: { high: 30, balanced: 34, small: 38 },
};

const AUDIO_KBPS: Record<VideoQuality, number> = { high: 160, balanced: 128, small: 96 };

export interface ConvertOptions {
  inputName: string;
  outputName: string;
  format: VideoFormat;
  quality: VideoQuality;
  resolution: ResolutionChoice;
  meta: Pick<VideoMeta, "width" | "height">;
  caps: EncoderCaps;
  fpsCap?: number;
}

/**
 * Builds the exact ffmpeg argv. Single-thread core, so no -threads juggling.
 * MP4 always gets +faststart (metadata first → starts playing while downloading).
 */
export function buildFfmpegArgs(o: ConvertOptions): string[] {
  const { width, height } = targetDimensions(o.meta.width, o.meta.height, o.resolution);
  const fps = o.fpsCap ?? FPS_CAP;
  // -fpsmax is a *ceiling*: a 24 fps source stays 24 fps instead of being interpolated up
  // to 30 (which -r would do, making the file bigger for no visual gain).
  const args = ["-i", o.inputName, "-vf", `scale=${width}:${height}`, "-fpsmax", String(fps)];
  const audio = audioEncoderFor(o.format, o.caps);

  if (o.format === "mp4") {
    args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", String(CRF.mp4[o.quality]));
    args.push("-pix_fmt", "yuv420p", "-movflags", "+faststart");
  } else {
    args.push("-c:v", "libvpx-vp9", "-b:v", "0", "-crf", String(CRF.webm[o.quality]));
    args.push("-row-mt", "1", "-pix_fmt", "yuv420p");
  }
  // Never name an encoder this core did not report; drop the audio track instead.
  if (audio) args.push("-c:a", audio, "-b:a", `${AUDIO_KBPS[o.quality]}k`);
  else args.push("-an");

  args.push("-y", o.outputName);
  return args;
}


/**
 * Smart preset: compatible container, max 1080p, capped fps, sensible quality by source size.
 * Falls back to whatever the core can actually encode.
 */
export function smartPreset(
  meta: VideoMeta,
  caps: EncoderCaps,
): { format: VideoFormat; resolution: ResolutionChoice; quality: VideoQuality } | null {
  const formats = availableFormats(caps);
  if (!formats.length) return null;
  const format: VideoFormat = formats.includes("mp4") ? "mp4" : "webm";
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
