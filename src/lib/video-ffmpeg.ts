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
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
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
    throw e;
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
  const cancelled = () => new DOMException("Cancelled", "AbortError");
  if (signal?.aborted) throw cancelled();

  onProgress?.({ ratio: 0, stage: "loading" });

  // Cancelling while the ~30 MB core is still downloading must terminate the instance and
  // never proceed to an encode.
  let loadAborted = false;
  const abortDuringLoad = () => { loadAborted = true; terminateFFmpeg(); };
  signal?.addEventListener("abort", abortDuringLoad, { once: true });
  let ff: FFmpegInstance;
  try {
    ff = await getFFmpeg();
  } finally {
    signal?.removeEventListener("abort", abortDuringLoad);
  }
  if (loadAborted || signal?.aborted) throw cancelled();

  const inputName = `in.${(file.name.match(/\.([A-Za-z0-9]{2,5})$/)?.[1] ?? "mp4").toLowerCase()}`;
  const outputName = `out.${options.format}`;
  const args = buildFfmpegArgs({ ...options, inputName, outputName });

  const onProg = ((e: { progress: number }) =>
    onProgress?.({ ratio: Math.min(1, Math.max(0, e.progress)), stage: "encoding" })) as never;
  ff.on("progress", onProg);

  const abort = () => terminateFFmpeg();
  signal?.addEventListener("abort", abort, { once: true });

  let wrote = false;
  try {
    onProgress?.({ ratio: 0, stage: "reading" });
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (signal?.aborted) throw cancelled();
    // MUST be awaited: exec on a half-written virtual FS reads a truncated input.
    await ff.writeFile(inputName, bytes);
    wrote = true;
    if (signal?.aborted) throw cancelled();
    await ff.exec(args);
    if (signal?.aborted) throw cancelled();
    onProgress?.({ ratio: 1, stage: "finishing" });
    const data = await ff.readFile(outputName);
    const out = typeof data === "string" ? new TextEncoder().encode(data) : data;
    const buffer = out.slice().buffer as ArrayBuffer;
    const blob = new Blob([buffer], { type: options.format === "mp4" ? "video/mp4" : "video/webm" });
    return { blob, size: blob.size };
  } finally {
    signal?.removeEventListener("abort", abort);
    try {
      ff.off("progress", onProg);
    } catch {
      /* instance already terminated by cancel */
    }
    if (wrote) {
      // Both paths are attempted independently so one failure cannot leak the other file.
      for (const name of [inputName, outputName]) {
        try {
          await ff.deleteFile(name);
        } catch {
          /* file absent or instance terminated */
        }
      }
    }

  }
}

