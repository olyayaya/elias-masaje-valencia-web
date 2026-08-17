/**
 * Media categorization for the Dashboard Library.
 *
 * The kind is decided by the *trusted* storage MIME metadata first and only falls back to the
 * filename extension when storage reported nothing usable. Anything we cannot positively
 * identify is "other" — an unknown file is never silently counted as a photo.
 */

export type MediaKind = "photo" | "video" | "other";

/** Extensions we render as photos. */
export const PHOTO_EXTS = ["jpg", "jpeg", "png", "webp", "avif", "gif", "svg"] as const;
/** Video containers accepted as converter/upload input. */
export const VIDEO_INPUT_EXTS = ["mp4", "mov", "m4v", "webm"] as const;
/** Containers the local converter is allowed to write. */
export const VIDEO_OUTPUT_EXTS = ["mp4", "webm"] as const;

export const VIDEO_MIME_BY_EXT: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  webm: "video/webm",
};

export const extOf = (name: string): string =>
  (name.match(/\.([A-Za-z0-9]{2,5})$/)?.[1] ?? "").toLowerCase();

const isPhotoExt = (ext: string) => (PHOTO_EXTS as readonly string[]).includes(ext);
const isVideoExt = (ext: string) => (VIDEO_INPUT_EXTS as readonly string[]).includes(ext);

/**
 * `mimeType` must come from storage object metadata (or a real File object) — never from
 * a user-typed field. An empty/octet-stream MIME is treated as "no information".
 */
export function kindOf(file: { name: string; mimeType?: string | null }): MediaKind {
  const mime = (file.mimeType ?? "").toLowerCase().split(";")[0].trim();
  if (mime && mime !== "application/octet-stream" && mime !== "binary/octet-stream") {
    if (mime.startsWith("image/")) return "photo";
    if (mime.startsWith("video/")) return "video";
    return "other";
  }
  const ext = extOf(file.name);
  if (isPhotoExt(ext)) return "photo";
  if (isVideoExt(ext)) return "video";
  return "other";
}

export function countByKind<T extends { name: string; mimeType?: string | null }>(
  files: T[],
): Record<MediaKind, number> {
  const out: Record<MediaKind, number> = { photo: 0, video: 0, other: 0 };
  for (const f of files) out[kindOf(f)] += 1;
  return out;
}

/** Accept attribute for the upload zone: images plus the video containers we support. */
export const UPLOAD_ACCEPT = [
  "image/*",
  "video/*",
  ...VIDEO_INPUT_EXTS.map((e) => `.${e}`),
].join(",");

/** True when a File picked in the browser should go through the video pipeline. */
export function isVideoFile(file: { name: string; type?: string }): boolean {
  return kindOf({ name: file.name, mimeType: file.type }) === "video";
}

/**
 * Filenames are sanitized before they ever reach storage: no paths, no exotic characters,
 * lowercase extension, bounded length. Collision-safety is added separately.
 */
export function sanitizeFileName(raw: string): string {
  const ext = extOf(raw);
  const base = raw
    .replace(/\.[^.]+$/, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "")
    .slice(0, 80);
  const safeBase = base || "file";
  return ext ? `${safeBase}.${ext}` : safeBase;
}

/** Adds a timestamp prefix so two uploads of the same name never collide. */
export function collisionSafeName(raw: string, taken: Iterable<string> = [], now = Date.now()): string {
  const used = new Set(taken);
  const clean = sanitizeFileName(raw);
  let candidate = `${now}-${clean}`;
  let i = 1;
  while (used.has(candidate)) candidate = `${now}-${i++}-${clean}`;
  return candidate;
}
