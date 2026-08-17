/**
 * Video cover (poster) extraction for Dashboard → Gallery.
 *
 * This module is only ever reached through a dynamic `import()` triggered by an
 * explicit admin click, so neither it nor the FFmpeg core it may pull in is part of
 * the initial bundle or of any public page.
 *
 * Strategy:
 *  1. Decode the video in a plain <video> element and paint one frame to a canvas.
 *     This is free — no WASM download at all — and works for MP4/WebM.
 *  2. Only when the browser cannot decode the container do we lazily load the
 *     FFmpeg core (a further separate chunk) and extract the frame there.
 */

import { collisionSafeName, extOf } from "@/lib/media-kind";

/** Bounded output so a cover never becomes a heavyweight asset. */
export const POSTER_MAX_WIDTH = 1280;
export const POSTER_QUALITY = 0.82;
/** Default seek position; a frame at 0s is very often black. */
export const POSTER_DEFAULT_SECOND = 1;

export interface PosterOptions {
  videoUrl: string;
  atSeconds?: number;
  maxWidth?: number;
  signal?: AbortSignal;
  onProgress?: (ratio: number) => void;
}

export interface PosterResult {
  blob: Blob;
  width: number;
  height: number;
  ext: "webp" | "jpg";
  mimeType: string;
  /** Which path produced the frame — surfaced in tests and dev logs. */
  source: "canvas" | "ffmpeg";
}

export class PosterAbortError extends Error {
  constructor() {
    super("aborted");
    this.name = "PosterAbortError";
  }
}

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new PosterAbortError();
};

/** Poster object name derived from the video's — never overwrites an existing file. */
export function posterNameFor(videoUrl: string, ext: "webp" | "jpg", taken: Iterable<string> = [], now = Date.now()) {
  const raw = decodeURIComponent(videoUrl.split("?")[0].split("/").pop() || "video");
  const base = raw.replace(/\.[^.]+$/, "").replace(/^\d{10,}-/, "") || "video";
  return collisionSafeName(`${base}-cover.${ext}`, taken, now);
}

function encodeCanvas(canvas: HTMLCanvasElement): Promise<{ blob: Blob; ext: "webp" | "jpg"; mimeType: string }> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (webp) => {
        if (webp && webp.size > 0 && webp.type === "image/webp") {
          resolve({ blob: webp, ext: "webp", mimeType: "image/webp" });
          return;
        }
        canvas.toBlob(
          (jpg) => {
            if (jpg && jpg.size > 0) resolve({ blob: jpg, ext: "jpg", mimeType: "image/jpeg" });
            else reject(new Error("Could not encode the extracted frame"));
          },
          "image/jpeg",
          POSTER_QUALITY,
        );
      },
      "image/webp",
      POSTER_QUALITY,
    );
  });
}

/** Frame grab through the browser's own decoder. Rejects when the container is unsupported. */
export async function captureFrameWithCanvas(opts: PosterOptions): Promise<PosterResult> {
  const { videoUrl, atSeconds = POSTER_DEFAULT_SECOND, maxWidth = POSTER_MAX_WIDTH, signal } = opts;
  throwIfAborted(signal);

  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;

  const cleanup = () => {
    // Every handler is detached before the element is dropped: a late `seeked` or
    // `error` from a cancelled capture must not resolve or reject anything.
    video.onerror = null;
    video.onloadedmetadata = null;
    video.onseeked = null;
    video.removeAttribute("src");
    try {
      video.load();
    } catch {
      /* jsdom */
    }
  };

  let onAbort: (() => void) | null = null;
  try {
    await new Promise<void>((resolve, reject) => {
      onAbort = () => reject(new PosterAbortError());
      signal?.addEventListener("abort", onAbort, { once: true });
      video.onerror = () => reject(new Error("The browser could not decode this video"));
      video.onloadedmetadata = () => {
        const target = Math.min(Math.max(0, atSeconds), Math.max(0, (video.duration || 0) - 0.1));
        video.onseeked = () => resolve();
        try {
          video.currentTime = target;
        } catch {
          resolve();
        }
      };
      video.src = videoUrl;
    });

    throwIfAborted(signal);
    opts.onProgress?.(0.6);

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) throw new Error("The browser could not decode this video");

    const scale = Math.min(1, maxWidth / vw);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(vw * scale));
    canvas.height = Math.max(1, Math.round(vh * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    throwIfAborted(signal);
    const { blob, ext, mimeType } = await encodeCanvas(canvas);
    opts.onProgress?.(1);
    return { blob, width: canvas.width, height: canvas.height, ext, mimeType, source: "canvas" };
  } finally {
    // The abort listener is scoped to this capture only — it is removed on every exit.
    if (onAbort) signal?.removeEventListener("abort", onAbort);
    cleanup();
  }
}

/** Last-resort frame grab through the lazily loaded FFmpeg core. */
export async function captureFrameWithFFmpeg(opts: PosterOptions): Promise<PosterResult> {
  const { videoUrl, atSeconds = POSTER_DEFAULT_SECOND, maxWidth = POSTER_MAX_WIDTH, signal } = opts;
  throwIfAborted(signal);

  // Separate chunk: the WASM core is only fetched once we get here.
  const { getFFmpeg, terminateFFmpeg } = await import("@/lib/video-ffmpeg");
  throwIfAborted(signal);

  // Same pattern as the converter: cancelling during the ~30 MB core download (or during
  // the exec) terminates the instance instead of leaving the wasm heap allocated.
  const abortEngine = () => terminateFFmpeg();
  signal?.addEventListener("abort", abortEngine, { once: true });

  const token = Math.random().toString(36).slice(2, 10);
  const ext = extOf(videoUrl.split("?")[0]) || "mp4";
  const inName = `poster-${token}-in.${ext}`;
  const outName = `poster-${token}-out.jpg`;

  let ffmpeg: Awaited<ReturnType<typeof getFFmpeg>>;
  try {
    ffmpeg = await getFFmpeg(undefined, signal);
    throwIfAborted(signal);

    const res = await fetch(videoUrl, { signal });
    if (!res.ok) throw new Error(`Could not download the video (${res.status})`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    throwIfAborted(signal);
    opts.onProgress?.(0.5);

    try {
      await ffmpeg.writeFile(inName, bytes);
      throwIfAborted(signal);
      const code = await ffmpeg.exec([
        "-ss", String(Math.max(0, atSeconds)),
        "-i", inName,
        "-frames:v", "1",
        "-vf", `scale='min(${maxWidth},iw)':-2`,
        "-q:v", "3",
        outName,
      ]);
      throwIfAborted(signal);
      if (typeof code === "number" && code !== 0) throw new Error(`Frame extraction failed (code ${code})`);
      const data = (await ffmpeg.readFile(outName)) as Uint8Array;
      if (!data || data.length === 0) throw new Error("Frame extraction produced no data");
      opts.onProgress?.(1);
      return {
        blob: new Blob([data as BlobPart], { type: "image/jpeg" }),
        width: 0,
        height: 0,
        ext: "jpg",
        mimeType: "image/jpeg",
        source: "ffmpeg",
      };
    } finally {
      // The virtual FS is always cleaned, including on abort and on failure.
      for (const f of [inName, outName]) {
        try {
          await ffmpeg.deleteFile(f);
        } catch {
          /* best effort — file absent or instance terminated */
        }
      }
    }
  } finally {
    signal?.removeEventListener("abort", abortEngine);
  }
}


/**
 * Extract a cover frame, preferring the zero-cost canvas path and only paying for
 * the FFmpeg core when the browser cannot decode the container.
 */
export async function generatePoster(opts: PosterOptions): Promise<PosterResult> {
  try {
    return await captureFrameWithCanvas(opts);
  } catch (e) {
    if (e instanceof PosterAbortError) throw e;
    throwIfAborted(opts.signal);
    return await captureFrameWithFFmpeg(opts);
  }
}
