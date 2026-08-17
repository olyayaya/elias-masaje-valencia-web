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

/** Rename may only change the basename — format changes must go through compression. */
export function validateRenameExtension(oldName: string, newName: string): string | null {
  if (extOf(oldName) !== extOf(newName)) {
    return `Keep the .${extOf(oldName)} extension — change format via smart compression`;
  }
  return null;
}

export function validateOutputType(contentType: string, newName: string): string | null {
  const allowed = ALLOWED_OUTPUT[contentType];
  if (!allowed) return "Unsupported output format";
  if (!allowed.includes(extOf(newName))) return `Extension .${extOf(newName)} does not match ${contentType}`;
  return null;
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
