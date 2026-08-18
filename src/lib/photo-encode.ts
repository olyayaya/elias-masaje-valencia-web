/**
 * Photo encoding policy + browser encoder for the unified media processing dialog.
 *
 * Honesty contract (the whole point of this module):
 *  - the produced bytes, the reported MIME and the file extension ALWAYS agree;
 *  - PNG is lossless: it never gets a fake "quality" slider;
 *  - JPEG has no alpha, so a transparent source is flattened onto an explicitly chosen
 *    background (white by default — never black);
 *  - images are never upscaled.
 */

export type PhotoFormat = "jpg" | "png" | "webp";

export const PHOTO_MIME: Record<PhotoFormat, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const PHOTO_EXT: Record<PhotoFormat, string> = { jpg: "jpg", png: "png", webp: "webp" };

export const FORMAT_BY_MIME: Record<string, PhotoFormat> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Quality bounds shared by the slider, the number input and the encoder. */
export const MIN_QUALITY = 40;
export const MAX_QUALITY = 100;
export const DEFAULT_QUALITY = 82;

export type SizeChoice = "original" | "1920" | "1600" | "1280" | "custom";
export const SIZE_CHOICES: SizeChoice[] = ["original", "1920", "1600", "1280", "custom"];

/** JPEG cannot store alpha — this is the flattening colour, never black by default. */
export const DEFAULT_BACKGROUND = "#ffffff";

export interface PhotoSettings {
  format: PhotoFormat;
  /** Ignored (and hidden in the UI) for PNG, which is lossless here. */
  quality: number;
  size: SizeChoice;
  /** Only meaningful when size === "custom". Longest-edge limit in px. */
  customSize: number;
  /** Flatten colour used only when the target format has no alpha. */
  background: string;
}

/** True only for formats where the quality number actually changes the encoder output. */
export const supportsQuality = (format: PhotoFormat): boolean => format !== "png";

/** PNG here is honest lossless — no compression-level control is exposed. */
export const isLossless = (format: PhotoFormat): boolean => format === "png";

/** Formats that can carry transparency. */
export const supportsAlpha = (format: PhotoFormat): boolean => format !== "jpg";

export function clampQuality(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_QUALITY;
  return Math.min(MAX_QUALITY, Math.max(MIN_QUALITY, Math.round(n)));
}

/**
 * Target dimensions for a size choice. The limit applies to the LONGEST edge and an image
 * is never enlarged: a 900px source stays 900px even when 1920 is requested.
 */
export function photoTargetDimensions(
  width: number,
  height: number,
  choice: SizeChoice,
  customSize = 1920,
): { width: number; height: number } {
  const w = Math.max(1, Math.round(Number(width) || 1));
  const h = Math.max(1, Math.round(Number(height) || 1));
  if (choice === "original") return { width: w, height: h };
  const raw = choice === "custom" ? Number(customSize) : Number(choice);
  const limit = Number.isFinite(raw) ? Math.min(8000, Math.max(64, Math.round(raw))) : 1920;
  const longest = Math.max(w, h);
  if (longest <= limit) return { width: w, height: h }; // no upscale, ever
  const scale = limit / longest;
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

export interface PhotoSource {
  width: number;
  height: number;
  mime: string;
  /** True when the source can carry transparency (decided by format, then by pixels). */
  hasAlpha: boolean;
}

/** Formats this browser can really encode (probed once, cached by the caller). */
export interface PhotoCaps {
  webp: boolean;
  jpg: boolean;
  png: boolean;
}

export function availablePhotoFormats(caps: PhotoCaps): PhotoFormat[] {
  const out: PhotoFormat[] = [];
  if (caps.webp) out.push("webp");
  if (caps.jpg) out.push("jpg");
  if (caps.png) out.push("png");
  return out;
}

/**
 * Recommended settings: WebP when available (keeps alpha, best ratio), otherwise PNG for
 * transparent sources and JPEG for the rest. Large photos are capped at 1920px.
 */
export function smartPhotoPreset(source: PhotoSource, caps: PhotoCaps): PhotoSettings {
  const format: PhotoFormat = caps.webp
    ? "webp"
    : source.hasAlpha && caps.png
      ? "png"
      : caps.jpg
        ? "jpg"
        : "png";
  const longest = Math.max(source.width, source.height);
  return {
    format,
    quality: DEFAULT_QUALITY,
    size: longest > 1920 ? "1920" : "original",
    customSize: 1920,
    background: DEFAULT_BACKGROUND,
  };
}

/** True when the admin must be warned that transparency will be flattened. */
export const willFlattenAlpha = (settings: PhotoSettings, source: PhotoSource): boolean =>
  source.hasAlpha && !supportsAlpha(settings.format);

export type ManualVerdict =
  | { ok: true; savedBytes: number; savedPercent: number }
  | { ok: false; reason: "bigger" | "marginal"; savedBytes: number };

/** 10% AND 10 KB — the same contract the server re-applies for a Smart replace. */
export const MIN_SAVING_RATIO = 0.1;
export const MIN_SAVING_BYTES = 10 * 1024;

export function evaluatePhotoSaving(originalSize: number, newSize: number): ManualVerdict {
  const saved = originalSize - newSize;
  if (saved <= 0) return { ok: false, reason: "bigger", savedBytes: saved };
  if (saved < MIN_SAVING_BYTES || saved / originalSize < MIN_SAVING_RATIO) {
    return { ok: false, reason: "marginal", savedBytes: saved };
  }
  return { ok: true, savedBytes: saved, savedPercent: Math.round((saved / originalSize) * 100) };
}

/** Output filename for a source basename + produced format. */
export function photoOutputName(sourceName: string, format: PhotoFormat): string {
  const base = sourceName.replace(/\.[^.]+$/, "") || "image";
  return `${base}.${PHOTO_EXT[format]}`;
}

// ---------------------------------------------------------------------------
// Browser encoder
// ---------------------------------------------------------------------------

const canEncode = (mime: string): boolean => {
  try {
    return document.createElement("canvas").toDataURL(mime).startsWith(`data:${mime}`);
  } catch {
    return false;
  }
};

export function probePhotoCaps(): PhotoCaps {
  return { webp: canEncode("image/webp"), jpg: canEncode("image/jpeg"), png: true };
}

export function loadImageElement(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not decode this image")); };
    img.src = url;
  });
}

/** Cheap alpha probe: PNG/WebP/GIF/AVIF sources are treated as possibly transparent. */
export const mayHaveAlpha = (mime: string, name = ""): boolean =>
  /image\/(png|webp|gif|avif)/i.test(mime) || /\.(png|webp|gif|avif)$/i.test(name);

export interface EncodedPhoto {
  blob: Blob;
  mime: string;
  ext: string;
  format: PhotoFormat;
  width: number;
  height: number;
  size: number;
}

/**
 * Encodes a photo with the given settings. The returned MIME is read back from the produced
 * blob, so an engine that silently fell back to another codec can never be mislabelled.
 */
export async function encodePhoto(
  source: Blob,
  settings: PhotoSettings,
  sourceName = "image",
): Promise<EncodedPhoto> {
  const img = await loadImageElement(source);
  const { width, height } = photoTargetDimensions(
    img.naturalWidth,
    img.naturalHeight,
    settings.size,
    settings.customSize,
  );
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser");
  if (!supportsAlpha(settings.format)) {
    // JPEG has no alpha: flatten onto the chosen colour instead of the canvas default
    // (which composites transparent pixels to BLACK once encoded).
    ctx.fillStyle = settings.background || DEFAULT_BACKGROUND;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(img, 0, 0, width, height);

  const targetMime = PHOTO_MIME[settings.format];
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Encoding failed"))),
      targetMime,
      // PNG is lossless: passing a quality value would be meaningless, so we pass none.
      isLossless(settings.format) ? undefined : clampQuality(settings.quality) / 100,
    );
  });

  const producedMime = (blob.type || targetMime).toLowerCase();
  const format = FORMAT_BY_MIME[producedMime] ?? settings.format;
  return {
    blob,
    mime: PHOTO_MIME[format],
    ext: PHOTO_EXT[format],
    format,
    width,
    height,
    size: blob.size,
    ...(sourceName ? {} : {}),
  };
}
