// Pure, runtime-agnostic validation rules for media-guard.
// Imported by the Deno edge function AND by the vitest suite, so the rules that actually
// protect production are the ones under test (no re-implementation drift).

/** 15 MB decoded — far above any real dashboard image, low enough to bound memory. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
/** Server-side compression thresholds, mirrored in src/lib/media-compress.ts. */
export const MIN_SAVING_RATIO = 0.1;
export const MIN_SAVING_BYTES = 10 * 1024;

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;

export function validateName(name: string): string | null {
  if (!name) return "Name cannot be empty";
  if (name.includes("/") || name.includes("\\") || name.includes("..")) return "Name cannot contain paths";
  if (!NAME_RE.test(name)) return "Use letters, numbers, dot, dash and underscore only";
  if (!/\.[A-Za-z0-9]{2,5}$/.test(name)) return "Name must keep a file extension";
  return null;
}

export const extOf = (name: string) => (name.match(/\.([A-Za-z0-9]{2,5})$/)?.[1] ?? "").toLowerCase();

/** Raster formats we are allowed to write. GIF/SVG/AVIF are never re-encoded. */
export const ALLOWED_OUTPUT: Record<string, string[]> = {
  "image/webp": ["webp"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
};

/** Containers the local converter may commit. */
export const ALLOWED_VIDEO_OUTPUT: Record<string, string[]> = {
  "video/mp4": ["mp4"],
  "video/webm": ["webm"],
};

/** Video objects are committed by direct resumable upload, so this bound is generous. */
export const MAX_VIDEO_BYTES = 250 * 1024 * 1024;

/** Containers accepted as *source* of a conversion (upload allowlist, server side). */
export const ALLOWED_VIDEO_SOURCE: Record<string, string[]> = {
  "video/mp4": ["mp4"],
  "video/quicktime": ["mov"],
  "video/x-m4v": ["m4v"],
  "video/webm": ["webm"],
};

export const VIDEO_SOURCE_EXTS = ["mp4", "mov", "m4v", "webm"];

export function validateVideoSourceName(name: string): string | null {
  const bad = validateName(name);
  if (bad) return bad;
  if (!VIDEO_SOURCE_EXTS.includes(extOf(name))) {
    return `Unsupported video source .${extOf(name)} — use MP4, MOV, M4V or WebM`;
  }
  return null;
}

const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

/**
 * Staged objects are throwaway uploads awaiting promotion. The name is bound to the
 * uploading user so one admin can never commit another admin's staged bytes, and the
 * reserved prefix keeps them trivially identifiable (and never mistaken for real media).
 */
export const stagedPrefixFor = (userId: string) => `staged-${userId}-`;

export function stagedNameFor(userId: string, uuid: string, ext: string): string {
  return `${stagedPrefixFor(userId)}${uuid}.${ext.toLowerCase()}`;
}

/** Server-side gate: the staged object must belong to this user and be a real staged name. */
export function validateStagedName(
  stagedName: string,
  userId: string,
  conflicts: string[],
): string | null {
  if (stagedName.includes("/") || stagedName.includes("\\") || stagedName.includes("..")) {
    return "Invalid staged object name";
  }
  const re = new RegExp(`^staged-${UUID}-${UUID}\\.[A-Za-z0-9]{2,5}$`);
  if (!re.test(stagedName)) return "Invalid staged object name";
  if (!stagedName.startsWith(stagedPrefixFor(userId))) return "Staged object does not belong to this user";
  if (conflicts.some((c) => c && c === stagedName)) return "Staged object name collides with a real file";
  return null;
}

/** Backup of an original kept only for the duration of a same-name replacement. */
export const backupNameFor = (userId: string, uuid: string, original: string) =>
  `backup-${userId}-${uuid}-${original}`;

export const isServiceObject = (name: string) =>
  name.startsWith("staged-") || name.startsWith("backup-");


/** Rename may only change the basename — format changes must go through conversion. */
export function validateRenameExtension(oldName: string, newName: string): string | null {
  if (extOf(oldName) !== extOf(newName)) {
    return `Keep the .${extOf(oldName)} extension — change format via smart compression or video conversion`;
  }
  return null;
}

export function validateOutputType(contentType: string, newName: string): string | null {
  const allowed = ALLOWED_OUTPUT[contentType];
  if (!allowed) return "Unsupported output format";
  if (!allowed.includes(extOf(newName))) return `Extension .${extOf(newName)} does not match ${contentType}`;
  return null;
}

export function validateVideoOutputType(contentType: string, newName: string): string | null {
  const allowed = ALLOWED_VIDEO_OUTPUT[contentType];
  if (!allowed) return "Unsupported video output format";
  if (!allowed.includes(extOf(newName))) return `Extension .${extOf(newName)} does not match ${contentType}`;
  return null;
}

/**
 * Container sniffing on the first bytes of the uploaded object:
 *  - MP4/MOV: ISO-BMFF `ftyp` box at offset 4
 *  - WebM:    Matroska EBML magic 1A 45 DF A3
 * Guarantees the committed bytes really are the container the extension promises.
 */
export function videoMagicMatches(type: string, b: Uint8Array): boolean {
  if (type === "video/mp4") {
    return b.length > 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70;
  }
  if (type === "video/webm") {
    return b.length > 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3;
  }
  return false;
}

/** Verifies the declared MIME against the real file signature so contentType cannot be forged. */
export function magicMatches(type: string, b: Uint8Array): boolean {
  if (type === "image/png") {
    return b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a;
  }
  if (type === "image/jpeg") {
    return b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  }
  if (type === "image/webp") {
    return b.length > 12 &&
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  }
  return false;
}

export type SavingVerdict = { ok: true } | { ok: false; alreadyCompressed: boolean; message: string };

/**
 * Threshold check against the ACTUAL stored object size (never a client-reported value):
 * the new object must save at least 10% AND at least 10 KB.
 */
export function evaluateSaving(actualSourceSize: number, newSize: number): SavingVerdict {
  const saved = actualSourceSize - newSize;
  if (saved <= 0) {
    return { ok: false, alreadyCompressed: false, message: "Compressed result is not smaller — file left untouched" };
  }
  if (saved < MIN_SAVING_BYTES || saved / actualSourceSize < MIN_SAVING_RATIO) {
    return { ok: false, alreadyCompressed: true, message: "Image is already compressed — file left untouched" };
  }
  return { ok: true };
}

/**
 * Every public table + column a dashboard editor can put a media URL/filename into.
 * Kept in sync with public.rewrite_media_references (same tables, same columns) and
 * exported from this pure module so the vitest suite asserts the real scan list.
 * Deliberately NOT scanned:
 *   booking_leads / conversion_events -> visitor-submitted data, never an editor image source
 *   content_history                   -> immutable audit log; handled through media_aliases
 */
export const SCANS: { table: string; label: string; nameField: string; fields: string[] }[] = [
  { table: "blog_posts", label: "Blog post", nameField: "title", fields: ["content", "content_en", "content_ru", "meta_description", "meta_description_en", "meta_description_ru"] },
  { table: "site_content", label: "Site content", nameField: "label", fields: ["value_es", "value_en", "value_ru"] },
  { table: "page_images", label: "Image / carousel", nameField: "collection_key", fields: ["image_url", "alt_text", "alt_text_en", "alt_text_ru"] },
  { table: "services", label: "Service", nameField: "title", fields: ["description", "description_en", "description_ru"] },
  { table: "faqs", label: "FAQ", nameField: "question", fields: ["question", "question_en", "question_ru", "answer", "answer_en", "answer_ru"] },
  { table: "promotions", label: "Promotion", nameField: "badge_text", fields: ["badge_text", "badge_text_en", "badge_text_ru"] },
  { table: "testimonials", label: "Testimonial", nameField: "name", fields: ["quote", "quote_en", "quote_ru"] },
];

/**
 * Reads at most `bytes` bytes from a response body and stops the transfer.
 *
 * A storage backend is free to ignore our `Range` header and start streaming the whole
 * object, so a single first chunk can be megabytes wide. Only the promised prefix of each
 * chunk is ever copied into the fixed-size buffer, and the reader is cancelled as soon as
 * the buffer is full — the function never retains (or downloads) more than `bytes`.
 */
export async function readHeadFromStream(
  body: ReadableStream<Uint8Array> | null,
  bytes = 64,
): Promise<Uint8Array> {
  if (!body) return new Uint8Array(0);
  const reader = body.getReader();
  const head = new Uint8Array(bytes);
  let total = 0;
  try {
    while (total < bytes) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.length) continue;
      const take = Math.min(value.length, bytes - total);
      head.set(value.subarray(0, take), total);
      total += take;
    }
  } finally {
    // Stops the download immediately — nothing beyond the head is ever transferred.
    await reader.cancel().catch(() => undefined);
  }
  return head.subarray(0, total);
}
