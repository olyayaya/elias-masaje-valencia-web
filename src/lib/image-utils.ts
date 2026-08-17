/**
 * Client-side image optimization utilities.
 * Resizes and compresses images before upload.
 *
 * Format contract: the returned blob's MIME type, the reported extension and the actual
 * encoded bytes ALWAYS agree. A PNG source is never silently written out as JPEG bytes
 * under a .png name — when WebP is unavailable, PNG stays PNG so alpha survives.
 */

const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1920;
const QUALITY = 0.82;
const THUMB_SIZE = 400;

export function supportsWebp(): boolean {
  try {
    return document.createElement("canvas").toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
}

export const EXT_BY_MIME: Record<string, string> = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
};

/**
 * Picks the output encoding for a source image.
 * - WebP when the browser can encode it (keeps alpha, best ratio)
 * - otherwise PNG for PNG sources (lossless, keeps alpha) and JPEG for everything else
 */
export function pickEncodeTarget(sourceType?: string): { mime: string; ext: string } {
  if (supportsWebp()) return { mime: "image/webp", ext: "webp" };
  if ((sourceType || "").toLowerCase() === "image/png") return { mime: "image/png", ext: "png" };
  return { mime: "image/jpeg", ext: "jpg" };
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function drawResized(
  img: HTMLImageElement,
  maxW: number,
  maxH: number,
  quality: number,
  format: string = "image/webp"
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (w > maxW || h > maxH) {
      const ratio = Math.min(maxW / w, maxH / h);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return reject(new Error("Canvas not supported"));
    ctx.drawImage(img, 0, 0, w, h);
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Blob conversion failed"))),
      format,
      quality
    );
  });
}

export interface OptimizedImage {
  blob: Blob;
  /** Extension matching the encoded bytes — always consistent with blob.type. */
  ext: string;
  mime: string;
  width: number;
  height: number;
  originalSize: number;
  optimizedSize: number;
}

/**
 * Optimize an image: resize to max dimensions and re-encode with an alpha-safe format.
 */
export async function optimizeImage(file: Blob): Promise<OptimizedImage> {
  const img = await loadImage(file);
  const target = pickEncodeTarget(file.type);
  const blob = await drawResized(img, MAX_WIDTH, MAX_HEIGHT, QUALITY, target.mime);
  URL.revokeObjectURL(img.src);
  // Some engines fall back to PNG if a format is unsupported — trust the produced bytes.
  const mime = (blob.type || target.mime).toLowerCase();
  return {
    blob,
    mime,
    ext: EXT_BY_MIME[mime] ?? target.ext,
    width: Math.min(img.naturalWidth, MAX_WIDTH),
    height: Math.min(img.naturalHeight, MAX_HEIGHT),
    originalSize: file.size,
    optimizedSize: blob.size,
  };
}

/**
 * Generate a thumbnail blob from a file.
 */
export async function generateThumbnail(file: Blob): Promise<Blob> {
  const img = await loadImage(file);
  const target = pickEncodeTarget(file.type);
  const blob = await drawResized(img, THUMB_SIZE, THUMB_SIZE, 0.75, target.mime);
  URL.revokeObjectURL(img.src);
  return blob;
}

/**
 * Extension for a freshly optimized upload. Pass the source MIME so PNG sources
 * keep transparency when WebP encoding is unavailable.
 */
export function getOptimizedExtension(sourceType?: string): string {
  return pickEncodeTarget(sourceType).ext;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
