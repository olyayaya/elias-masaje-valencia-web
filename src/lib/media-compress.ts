import { optimizeImage, getOptimizedExtension } from "./image-utils";

/** Minimum relative + absolute saving required before we overwrite a stored file. */
export const MIN_SAVING_RATIO = 0.1; // 10%
export const MIN_SAVING_BYTES = 10 * 1024; // 10 KB

export type CompressOutcome =
  | { status: "unsupported"; reason: string }
  | { status: "already"; originalSize: number; candidateSize: number }
  | {
      status: "ready";
      blob: Blob;
      newName: string;
      originalSize: number;
      newSize: number;
      savedBytes: number;
      savedPercent: number;
    };

const UNSUPPORTED: Record<string, string> = {
  "image/gif": "GIF animation cannot be re-encoded without losing the animation",
  "image/svg+xml": "SVG is a vector format and does not need raster compression",
  "image/avif": "AVIF is already a modern compressed format",
};

const extOf = (name: string) => (name.match(/\.([A-Za-z0-9]{2,5})$/)?.[1] ?? "").toLowerCase();

/** Keeps transparency: PNG/WebP sources stay in a format that supports an alpha channel. */
function targetExtension(sourceExt: string): string {
  const optimized = getOptimizedExtension(); // "webp" when supported, else "jpg"
  if (optimized === "webp") return "webp"; // WebP keeps alpha
  return sourceExt === "png" ? "png" : "jpg"; // never flatten a PNG into JPEG
}

/**
 * Downloads a stored image, re-encodes it through the shared optimizeImage pipeline and
 * decides whether replacing the stored object is actually worth it.
 */
export async function analyzeCompression(url: string, fileName: string): Promise<CompressOutcome> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not read the source file (${res.status})`);
  const source = await res.blob();
  const type = (source.type || "").toLowerCase();
  const ext = extOf(fileName);

  if (UNSUPPORTED[type]) return { status: "unsupported", reason: UNSUPPORTED[type] };
  if (["gif", "svg", "avif"].includes(ext)) {
    return { status: "unsupported", reason: UNSUPPORTED[`image/${ext === "svg" ? "svg+xml" : ext}`] ?? "Format not supported" };
  }
  if (type && !type.startsWith("image/")) return { status: "unsupported", reason: "This file is not an image" };

  const originalSize = source.size;
  let optimized;
  try {
    optimized = await optimizeImage(source);
  } catch {
    return { status: "unsupported", reason: "This image could not be decoded in the browser" };
  }

  const candidateSize = optimized.blob.size;
  const saved = originalSize - candidateSize;
  if (saved < MIN_SAVING_BYTES || saved / originalSize < MIN_SAVING_RATIO) {
    return { status: "already", originalSize, candidateSize };
  }

  const targetExt = targetExtension(ext);
  const outExt = optimized.blob.type === "image/webp" ? "webp" : targetExt;
  const newName = ext === outExt ? fileName : `${fileName.replace(/\.[^.]+$/, "")}.${outExt}`;

  return {
    status: "ready",
    blob: optimized.blob,
    newName,
    originalSize,
    newSize: candidateSize,
    savedBytes: saved,
    savedPercent: Math.round((saved / originalSize) * 100),
  };
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(bin);
}
