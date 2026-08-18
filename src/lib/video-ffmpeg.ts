/**
 * Lazy ffmpeg.wasm bridge — the ONLY module that imports @ffmpeg/*.
 *
 * The glue is behind a dynamic import() so it becomes its own chunk, and the ~30 MB
 * single-thread core is self-hosted at /ffmpeg/* by the ffmpegCore Vite plugin (never
 * bundled, never fetched from a CDN, no SharedArrayBuffer / COOP / COEP requirement).
 */
// Kept in sync with vite-plugin-ffmpeg-core.ts (which emits these two files).
const FFMPEG_CORE_URL = "/ffmpeg/ffmpeg-core.js";
const FFMPEG_WASM_URL = "/ffmpeg/ffmpeg-core.wasm";

import {
  buildFfmpegArgs,
  buildStripAudioArgs,
  MIME_BY_FORMAT,
  logHasAudioStream,
  parseEncoderCaps,
  type ConvertOptions,
  type EncoderCaps,
  type VideoMeta,
} from "./video-convert";


type FFmpegInstance = {
  loaded: boolean;
  load: (opts: { coreURL: string; wasmURL: string }) => Promise<boolean>;
  exec: (args: string[]) => Promise<number>;
  writeFile: (name: string, data: Uint8Array) => Promise<boolean>;
  readFile: (name: string) => Promise<Uint8Array | string>;
  deleteFile: (name: string) => Promise<boolean>;
  terminate: () => void;
  on: (event: string, cb: (e: never) => void) => void;
  off: (event: string, cb: (e: never) => void) => void;
};

let instance: FFmpegInstance | null = null;
let caps: EncoderCaps | null = null;

export const isConverterSupported = (): boolean =>
  typeof WebAssembly === "object" && typeof WebAssembly.instantiate === "function";

const cancelled = () => new DOMException("Cancelled", "AbortError");

/**
 * Failure categories the UI can turn into a friendly, actionable sentence.
 * ffmpeg.wasm rejects with bare *strings* ("failed to import ffmpeg-core.js"), so without
 * this wrapper `(e as Error).message` is undefined and every failure collapsed into the
 * generic "Processing failed".
 */
export type VideoErrorCode = "load" | "read" | "encode" | "output" | "cancelled";

export class VideoEngineError extends Error {
  readonly code: VideoErrorCode;
  constructor(code: VideoErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "VideoEngineError";
    this.code = code;
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}

/** Anything ffmpeg.wasm throws (string, Error, event) into a readable one-liner. */
const describe = (e: unknown): string => {
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  return String((e as { message?: string } | null)?.message ?? e ?? "unknown error");
};

export const isAbort = (e: unknown): boolean => (e as DOMException | null)?.name === "AbortError";

/** Categorises a raw failure and keeps the original for the console (never for the user). */
export const engineError = (code: VideoErrorCode, e: unknown): Error => {
  if (isAbort(e)) return e as Error;
  if (e instanceof VideoEngineError) return e;
  if (import.meta.env?.DEV) console.error(`[video-ffmpeg:${code}]`, e);
  return new VideoEngineError(code, describe(e), e);
};


/** Tracks log callbacks so a probe never leaves a listener attached to the singleton. */
const logListeners = new Map<(line: string) => void, never>();

function attachLog(ff: FFmpegInstance, onLog?: (line: string) => void) {
  if (!onLog) return;
  const listener = ((e: { message: string }) => onLog(e.message)) as never;
  ff.on("log", listener);
  logListeners.set(onLog, listener);
}

function detachLog(ff: FFmpegInstance, onLog?: (line: string) => void) {
  if (!onLog) return;
  const listener = logListeners.get(onLog);
  if (!listener) return;
  logListeners.delete(onLog);
  try {
    ff.off("log", listener);
  } catch {
    /* instance already terminated */
  }
}

/** Throws away a core nobody is waiting for — it must never become the cached singleton. */
function discard(ff: FFmpegInstance, onLog?: (line: string) => void) {
  detachLog(ff, onLog);
  try {
    ff.terminate();
  } catch {
    /* already gone */
  }
}

/**
 * Loads (once) the ffmpeg glue + self-hosted single-thread core.
 * With a signal, an abort at any point (before the import, during the ~30 MB core download,
 * or just as it finishes) rejects with AbortError and leaves NO cached instance behind.
 */
export async function getFFmpeg(
  onLog?: (line: string) => void,
  signal?: AbortSignal,
): Promise<FFmpegInstance> {
  if (signal?.aborted) throw cancelled();
  if (instance?.loaded) {
    attachLog(instance, onLog);
    return instance;
  }
  let FFmpeg: new () => unknown;
  try {
    ({ FFmpeg } = (await import("@ffmpeg/ffmpeg")) as unknown as { FFmpeg: new () => unknown });
  } catch (e) {
    throw engineError("load", e);
  }
  if (signal?.aborted) throw cancelled();
  const ff = new FFmpeg() as unknown as FFmpegInstance;
  attachLog(ff, onLog);
  try {
    await ff.load({
      coreURL: new URL(FFMPEG_CORE_URL, window.location.href).href,
      wasmURL: new URL(FFMPEG_WASM_URL, window.location.href).href,
    });
  } catch (e) {
    discard(ff, onLog);
    throw engineError("load", e);
  }

  // Cancelled while the core was downloading: terminate the LOCAL instance even though it
  // was never published to `instance`, so the wasm heap is released immediately.
  if (signal?.aborted) {
    discard(ff, onLog);
    throw cancelled();
  }
  instance = ff;
  return ff;
}

/**
 * Runs `-encoders` once and caches which codecs this build can actually write.
 * An aborted probe never caches its (possibly empty) result.
 */
export async function probeEncoders(signal?: AbortSignal): Promise<EncoderCaps> {
  if (caps) return caps;
  if (signal?.aborted) throw cancelled();
  let log = "";
  const collect = (line: string) => { log += `${line}\n`; };
  const ff = await getFFmpeg(collect, signal);
  try {
    if (signal?.aborted) throw cancelled();
    await ff.exec(["-hide_banner", "-encoders"]);
    if (signal?.aborted) throw cancelled();
  } finally {
    // Without this the collector stays attached forever and grows on every conversion.
    detachLog(ff, collect);
  }
  // A core that reports nothing usable still has libx264 in practice only if detected;
  // never claim a codec we did not see.
  caps = parseEncoderCaps(log);
  return caps;
}

export function terminateFFmpeg() {
  try {
    instance?.terminate();
  } catch {
    /* already gone */
  }
  instance = null;
  caps = null;
  logListeners.clear();
}

/** Test/diagnostic helper: is a loaded core currently cached? */
export const hasLoadedCore = (): boolean => Boolean(instance?.loaded);
/** Test helper: number of log listeners still attached to the singleton. */
export const attachedLogListeners = (): number => logListeners.size;



/** Reads width/height/duration from a File using the plain <video> element (no wasm needed). */
export function probeVideoMeta(file: File): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement("video");
    el.preload = "metadata";
    el.muted = true;
    const done = (fn: () => void) => {
      URL.revokeObjectURL(url);
      el.removeAttribute("src");
      fn();
    };
    el.onloadedmetadata = () =>
      done(() =>
        resolve({
          width: el.videoWidth,
          height: el.videoHeight,
          duration: Number.isFinite(el.duration) ? el.duration : 0,
          size: file.size,
        }),
      );
    el.onerror = () => done(() => reject(new Error("Could not read video metadata")));
    el.src = url;
  });
}

export interface ConversionProgress {
  /** 0..1 */
  ratio: number;
  stage: "loading" | "reading" | "encoding" | "finishing";
}

export interface ConversionResult {
  blob: Blob;
  size: number;
}

/**
 * Transcodes locally. Always cleans the virtual FS, even on cancel/error, so repeated runs
 * cannot leak wasm heap memory.
 */
export async function convertVideo(
  file: File,
  options: Omit<ConvertOptions, "inputName" | "outputName">,
  handlers: {
    onProgress?: (p: ConversionProgress) => void;
    signal?: AbortSignal;
  } = {},
): Promise<ConversionResult> {
  const { onProgress, signal } = handlers;
  if (signal?.aborted) throw cancelled();

  onProgress?.({ ratio: 0, stage: "loading" });

  // Cancelling while the ~30 MB core is still downloading must terminate the instance and
  // never proceed to an encode. getFFmpeg additionally discards a core that finishes
  // loading after the abort, so nothing is cached either.
  const abortDuringLoad = () => terminateFFmpeg();
  signal?.addEventListener("abort", abortDuringLoad, { once: true });
  let ff: FFmpegInstance;
  try {
    ff = await getFFmpeg(undefined, signal);
  } finally {
    signal?.removeEventListener("abort", abortDuringLoad);
  }
  if (signal?.aborted) throw cancelled();

  const inputName = `in.${(file.name.match(/\.([A-Za-z0-9]{2,5})$/)?.[1] ?? "mp4").toLowerCase()}`;
  const outputName = `out.${options.format}`;
  const args = buildFfmpegArgs({ ...options, inputName, outputName });

  const onProg = ((e: { progress: number }) =>
    onProgress?.({ ratio: Math.min(1, Math.max(0, e.progress)), stage: "encoding" })) as never;
  ff.on("progress", onProg);

  const abort = () => terminateFFmpeg();
  signal?.addEventListener("abort", abort, { once: true });

  try {
    onProgress?.({ ratio: 0, stage: "reading" });
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await file.arrayBuffer());
      if (signal?.aborted) throw cancelled();
      // MUST be awaited: exec on a half-written virtual FS reads a truncated input.
      await ff.writeFile(inputName, bytes);
    } catch (e) {
      throw engineError("read", e);
    }
    if (signal?.aborted) throw cancelled();
    let code: number;
    try {
      code = await ff.exec(args);
    } catch (e) {
      throw engineError("encode", e);
    }
    // Checked BEFORE readFile: a failed encode can leave a stale/partial object behind.
    if (code !== 0) throw new VideoEngineError("encode", `ffmpeg exit code ${code}`);
    if (signal?.aborted) throw cancelled();
    onProgress?.({ ratio: 1, stage: "finishing" });
    try {
      const data = await ff.readFile(outputName);
      const out = typeof data === "string" ? new TextEncoder().encode(data) : data;
      const buffer = out.slice().buffer as ArrayBuffer;
      const blob = new Blob([buffer], { type: MIME_BY_FORMAT[options.format] });
      if (!blob.size) throw new Error("the converter produced an empty file");
      return { blob, size: blob.size };
    } catch (e) {
      throw engineError("output", e);
    }

  } finally {
    signal?.removeEventListener("abort", abort);
    try {
      ff.off("progress", onProg);
    } catch {
      /* instance already terminated by cancel */
    }
    // Always attempted, even when writeFile itself rejected: a partially written input
    // would otherwise stay in the wasm heap for the lifetime of the tab.
    for (const name of [inputName, outputName]) {
      try {
        await ff.deleteFile(name);
      } catch {
        /* file absent or instance terminated */
      }
    }
  }
}



// ---------------------------------------------------------------------------
// Audio removal (mute)
// ---------------------------------------------------------------------------

export interface StripAudioResult {
  blob: Blob;
  size: number;
  /** false when the source had no audio stream at all (honest "nothing to remove"). */
  hadAudio: boolean;
}

/**
 * Removes every audio stream locally by remuxing (video bitstream copied verbatim).
 * The container/extension and MIME are preserved, nothing is re-encoded, and the wasm
 * virtual FS is always cleaned — including on abort or failure.
 */
export async function stripAudio(
  file: File | Blob,
  options: { fileName: string; mimeType: string },
  handlers: { onProgress?: (ratio: number) => void; signal?: AbortSignal } = {},
): Promise<StripAudioResult> {
  const { onProgress, signal } = handlers;
  if (signal?.aborted) throw cancelled();

  let log = "";
  const collect = (line: string) => { log += `${line}\n`; };

  const abortDuringLoad = () => terminateFFmpeg();
  signal?.addEventListener("abort", abortDuringLoad, { once: true });
  let ff: FFmpegInstance;
  try {
    ff = await getFFmpeg(collect, signal);
  } finally {
    signal?.removeEventListener("abort", abortDuringLoad);
  }
  if (signal?.aborted) {
    detachLog(ff, collect);
    throw cancelled();
  }

  const ext = (options.fileName.match(/\.([A-Za-z0-9]{2,5})$/)?.[1] ?? "mp4").toLowerCase();
  // Unique per operation: a fixed name would collide across concurrent runs on the
  // singleton core and let one run read another's output.
  const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const inputName = `mute-${token}-in.${ext}`;
  const outputName = `mute-${token}-out.${ext}`;
  const args = buildStripAudioArgs({ inputName, outputName });

  const onProg = ((e: { progress: number }) =>
    onProgress?.(Math.min(1, Math.max(0, e.progress)))) as never;
  ff.on("progress", onProg);
  const abort = () => terminateFFmpeg();
  signal?.addEventListener("abort", abort, { once: true });

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (signal?.aborted) throw cancelled();
    await ff.writeFile(inputName, bytes);
    if (signal?.aborted) throw cancelled();
    const code = await ff.exec(args);
    // Must be checked BEFORE readFile: a failed remux can leave a stale/partial object
    // in the virtual FS that would otherwise be uploaded as if it were valid.
    if (code !== 0) throw new Error(`Audio removal failed (ffmpeg exit code ${code})`);
    if (signal?.aborted) throw cancelled();
    const data = await ff.readFile(outputName);
    const out = typeof data === "string" ? new TextEncoder().encode(data) : data;
    const buffer = out.slice().buffer as ArrayBuffer;
    const blob = new Blob([buffer], { type: options.mimeType });
    if (!blob.size) throw new Error("Audio removal produced an empty file");
    return { blob, size: blob.size, hadAudio: logHasAudioStream(log) };

  } finally {
    signal?.removeEventListener("abort", abort);
    detachLog(ff, collect);
    try {
      ff.off("progress", onProg);
    } catch {
      /* instance already terminated by cancel */
    }
    for (const name of [inputName, outputName]) {
      try {
        await ff.deleteFile(name);
      } catch {
        /* file absent or instance terminated */
      }
    }
  }
}
