/**
 * Lazy ffmpeg.wasm bridge — the ONLY module that imports @ffmpeg/*.
 *
 * The glue is behind a dynamic import() so it becomes its own chunk, and the ~30 MB
 * single-thread core is self-hosted at /ffmpeg/* by the ffmpegCore Vite plugin (never
 * bundled, never fetched from a CDN, no SharedArrayBuffer / COOP / COEP requirement).
 */
import { FFMPEG_CORE_URL, FFMPEG_WASM_URL } from "../../vite-plugin-ffmpeg-core";
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

/** Loads (once) the ffmpeg glue + self-hosted single-thread core. */
export async function getFFmpeg(onLog?: (line: string) => void): Promise<FFmpegInstance> {
  if (instance?.loaded) return instance;
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const ff = new FFmpeg() as unknown as FFmpegInstance;
  ff.on("log", ((e: { message: string }) => onLog?.(e.message)) as never);
  await ff.load({
    coreURL: new URL(FFMPEG_CORE_URL, window.location.href).href,
    wasmURL: new URL(FFMPEG_WASM_URL, window.location.href).href,
  });
  instance = ff;
  return ff;
}

/** Runs `-encoders` once and caches which codecs this build can actually write. */
export async function probeEncoders(): Promise<EncoderCaps> {
  if (caps) return caps;
  let log = "";
  const ff = await getFFmpeg((line) => { log += `${line}\n`; });
  await ff.exec(["-hide_banner", "-encoders"]);
  const parsed = parseEncoderCaps(log);
  // A core that reports nothing usable still has libx264 in practice only if detected;
  // never claim a codec we did not see.
  caps = parsed;
  return parsed;
}

export function terminateFFmpeg() {
  try {
    instance?.terminate();
  } catch {
    /* already gone */
  }
  instance = null;
  caps = null;
}

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
  onProgress?.({ ratio: 0, stage: "loading" });
  const ff = await getFFmpeg();

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
    ff.writeFile(inputName, new Uint8Array(await file.arrayBuffer()));
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    await ff.exec(args);
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    onProgress?.({ ratio: 1, stage: "finishing" });
    const data = await ff.readFile(outputName);
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
    const buffer = bytes.slice().buffer as ArrayBuffer;
    const blob = new Blob([buffer], { type: options.format === "mp4" ? "video/mp4" : "video/webm" });
    return { blob, size: blob.size };
  } finally {
    signal?.removeEventListener("abort", abort);
    try {
      ff.off("progress", onProg);
      await ff.deleteFile(inputName).catch(() => undefined);
      await ff.deleteFile(outputName).catch(() => undefined);
    } catch {
      /* instance already terminated by cancel */
    }
  }
}
