/**
 * Client-side image optimization utilities.
 * Resizes and compresses images before upload.
 */

const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1920;
const QUALITY = 0.82;
const THUMB_SIZE = 400;

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
  width: number;
  height: number;
  originalSize: number;
  optimizedSize: number;
}

/**
 * Optimize an image file: resize to max dimensions and compress as WebP.
 */
export async function optimizeImage(file: File): Promise<OptimizedImage> {
  const img = await loadImage(file);
  const supportsWebp = document.createElement("canvas").toDataURL("image/webp").startsWith("data:image/webp");
  const format = supportsWebp ? "image/webp" : "image/jpeg";
  const blob = await drawResized(img, MAX_WIDTH, MAX_HEIGHT, QUALITY, format);
  URL.revokeObjectURL(img.src);
  return {
    blob,
    width: Math.min(img.naturalWidth, MAX_WIDTH),
    height: Math.min(img.naturalHeight, MAX_HEIGHT),
    originalSize: file.size,
    optimizedSize: blob.size,
  };
}

/**
 * Generate a thumbnail blob from a file.
 */
export async function generateThumbnail(file: File): Promise<Blob> {
  const img = await loadImage(file);
  const supportsWebp = document.createElement("canvas").toDataURL("image/webp").startsWith("data:image/webp");
  const format = supportsWebp ? "image/webp" : "image/jpeg";
  const blob = await drawResized(img, THUMB_SIZE, THUMB_SIZE, 0.75, format);
  URL.revokeObjectURL(img.src);
  return blob;
}

/**
 * Get optimized extension based on browser support
 */
export function getOptimizedExtension(): string {
  const supportsWebp = document.createElement("canvas").toDataURL("image/webp").startsWith("data:image/webp");
  return supportsWebp ? "webp" : "jpg";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
