import { optimizeImage, EXT_BY_MIME } from "./image-utils";

/** Minimum relative + absolute saving required before we overwrite a stored file. */
export const MIN_SAVING_RATIO = 0.1; // 10%
export const MIN_SAVING_BYTES = 10 * 1024; // 10 KB

export type UnsupportedReason = "gif" | "svg" | "avif" | "notImage" | "decode" | "tooLarge";

export type CompressOutcome =
  | { status: "unsupported"; reason: UnsupportedReason }
  | { status: "already"; originalSize: number; candidateSize: number }
  | {
      status: "ready";
      blob: Blob;
      newName: string;
      contentType: string;
      originalSize: number;
      newSize: number;
      savedBytes: number;
      savedPercent: number;
    };

/** Mirrors the server limit in supabase/functions/media-guard. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

const extOf = (name: string) => (name.match(/\.([A-Za-z0-9]{2,5})$/)?.[1] ?? "").toLowerCase();

const UNSUPPORTED_BY_TYPE: Record<string, UnsupportedReason> = {
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/avif": "avif",
};
const UNSUPPORTED_BY_EXT: Record<string, UnsupportedReason> = {
  gif: "gif",
  svg: "svg",
  avif: "avif",
};

/**
 * Downloads a stored image, re-encodes it through the shared optimizeImage pipeline and
 * decides whether replacing the stored object is actually worth it.
 * Never returns an output whose extension/MIME disagree with the produced bytes.
 */
export async function analyzeCompression(url: string, fileName: string): Promise<CompressOutcome> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not read the source file (${res.status})`);
  const source = await res.blob();
  const type = (source.type || "").toLowerCase();
  const ext = extOf(fileName);

  if (UNSUPPORTED_BY_TYPE[type]) return { status: "unsupported", reason: UNSUPPORTED_BY_TYPE[type] };
  if (UNSUPPORTED_BY_EXT[ext]) return { status: "unsupported", reason: UNSUPPORTED_BY_EXT[ext] };
  if (type && !type.startsWith("image/")) return { status: "unsupported", reason: "notImage" };

  const originalSize = source.size;
  let optimized;
  try {
    optimized = await optimizeImage(source);
  } catch {
    return { status: "unsupported", reason: "decode" };
  }

  const candidateSize = optimized.blob.size;
  if (candidateSize > MAX_UPLOAD_BYTES) return { status: "unsupported", reason: "tooLarge" };

  const saved = originalSize - candidateSize;
  if (saved < MIN_SAVING_BYTES || saved / originalSize < MIN_SAVING_RATIO) {
    return { status: "already", originalSize, candidateSize };
  }

  // Extension always derives from the bytes that were actually produced.
  const outExt = EXT_BY_MIME[optimized.mime] ?? optimized.ext;
  const newName = ext === outExt ? fileName : `${fileName.replace(/\.[^.]+$/, "")}.${outExt}`;

  return {
    status: "ready",
    blob: optimized.blob,
    contentType: optimized.mime,
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
