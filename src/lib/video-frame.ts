/**
 * Capture the frame a <video> element is currently showing.
 *
 * This never re-encodes the video: one `drawImage` into a bounded canvas, encoded as
 * WebP (JPEG fallback). Used by the Library preview and by Edit/Replace to pick a
 * poster for a clip.
 */

export const FRAME_MAX_DIM = 1280;
export const FRAME_QUALITY = 0.82;

export type FrameErrorCode = "cors" | "notReady" | "encode";

export class FrameCaptureError extends Error {
  code: FrameErrorCode;
  constructor(code: FrameErrorCode, message: string) {
    super(message);
    this.name = "FrameCaptureError";
    this.code = code;
  }
}

export interface CapturedFrame {
  blob: Blob;
  width: number;
  height: number;
  ext: "webp" | "jpg";
  mimeType: string;
}

/** Bounded output box that preserves the clip's aspect ratio (portrait included). */
export function frameTargetSize(width: number, height: number, maxDim = FRAME_MAX_DIM): { width: number; height: number } {
  const w = Math.max(1, Math.round(width || 0));
  const h = Math.max(1, Math.round(height || 0));
  const scale = Math.min(1, maxDim / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

function encodeCanvas(canvas: HTMLCanvasElement): Promise<{ blob: Blob; ext: "webp" | "jpg"; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const fail = () => reject(new FrameCaptureError("encode", "Could not encode the captured frame"));
    try {
      canvas.toBlob(
        (webp) => {
          if (webp && webp.size > 0 && webp.type === "image/webp") {
            resolve({ blob: webp, ext: "webp", mimeType: "image/webp" });
            return;
          }
          try {
            canvas.toBlob(
              (jpg) => {
                if (jpg && jpg.size > 0) resolve({ blob: jpg, ext: "jpg", mimeType: "image/jpeg" });
                else fail();
              },
              "image/jpeg",
              FRAME_QUALITY,
            );
          } catch {
            fail();
          }
        },
        "image/webp",
        FRAME_QUALITY,
      );
    } catch {
      fail();
    }
  });
}

/**
 * Draw the current frame of `video` and encode it. Throws a FrameCaptureError with a
 * machine-readable `code` so the UI can show a localized message and log the technical
 * reason separately.
 */
export async function captureVideoFrame(
  video: HTMLVideoElement,
  maxDim = FRAME_MAX_DIM,
): Promise<CapturedFrame> {
  const vw = video?.videoWidth ?? 0;
  const vh = video?.videoHeight ?? 0;
  if (!vw || !vh) throw new FrameCaptureError("notReady", "The video has not produced a frame yet");

  const { width, height } = frameTargetSize(vw, vh, maxDim);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new FrameCaptureError("encode", "Canvas is not available");

  try {
    ctx.drawImage(video, 0, 0, width, height);
  } catch (e) {
    throw new FrameCaptureError("cors", `Frame is protected by CORS: ${(e as Error)?.message ?? ""}`);
  }

  let encoded: { blob: Blob; ext: "webp" | "jpg"; mimeType: string };
  try {
    encoded = await encodeCanvas(canvas);
  } catch (e) {
    // A tainted canvas rejects at read time, not at draw time.
    if ((e as Error)?.name === "SecurityError") {
      throw new FrameCaptureError("cors", (e as Error).message);
    }
    throw e;
  }
  return { ...encoded, width, height };
}
