/**
 * Poster (cover) model for Library videos.
 *
 * No new schema, no metadata table: a poster is a plain **sidecar object** in the same
 * `media` bucket whose name is derived deterministically from the video's name —
 * `clip.mp4` → `clip-cover.webp` (or `clip-cover.jpg`). That keeps everything the
 * Library already knows (the object listing) sufficient to resolve posters, and it is
 * the same `-cover` convention `@/lib/gallery-poster` already produces.
 *
 * Lifecycle:
 *  - save    → upsert the sidecar (one object per video, never orphan duplicates)
 *  - rename  → the sidecar is renamed through media-guard, so gallery references follow
 *  - delete  → the sidecar is deleted through media-guard, which refuses if still in use
 */

import { supabase } from "@/integrations/supabase/client";
import { deleteMediaFile, renameMediaFile } from "@/lib/media-usage";

export const POSTER_SUFFIX = "-cover";
export const POSTER_EXTS = ["webp", "jpg"] as const;
export type PosterExt = (typeof POSTER_EXTS)[number];

const stripExt = (name: string) => name.replace(/\.[^.]+$/, "");

/** `clip.mp4` → `clip-cover` */
export const posterBaseFor = (videoName: string) => `${stripExt(videoName)}${POSTER_SUFFIX}`;

/** Deterministic sidecar name for a given encoding. */
export const posterNameFor = (videoName: string, ext: PosterExt = "webp") =>
  `${posterBaseFor(videoName)}.${ext}`;

/** The sidecar that actually exists for this video, if any (WebP wins over JPEG). */
export function findPosterName(videoName: string, names: Iterable<string>): string | null {
  const set = names instanceof Set ? names : new Set(names);
  for (const ext of POSTER_EXTS) {
    const candidate = posterNameFor(videoName, ext);
    if (set.has(candidate)) return candidate;
  }
  return null;
}

/** video name → sidecar name, for every video in the listing. */
export function posterMap(files: { name: string }[]): Record<string, string> {
  const names = new Set(files.map((f) => f.name));
  const out: Record<string, string> = {};
  for (const f of files) {
    const poster = findPosterName(f.name, names);
    if (poster && poster !== f.name) out[f.name] = poster;
  }
  return out;
}

export const publicMediaUrl = (name: string) =>
  supabase.storage.from("media").getPublicUrl(name).data.publicUrl;

/**
 * Store (or replace) the sidecar for a video. Upsert keeps exactly one object per
 * video; a stale sidecar in the *other* encoding is removed so a video can never end
 * up with two competing covers.
 */
export async function saveLibraryPoster(
  videoName: string,
  blob: Blob,
  ext: PosterExt,
  mimeType: string,
): Promise<string> {
  const name = posterNameFor(videoName, ext);
  const { error } = await supabase.storage
    .from("media")
    .upload(name, blob, { contentType: mimeType, upsert: true, cacheControl: "3600" });
  if (error) throw error;

  const stale = POSTER_EXTS.filter((e) => e !== ext).map((e) => posterNameFor(videoName, e));
  if (stale.length) {
    // Best effort: a leftover in the other format is cosmetic, never fatal.
    await supabase.storage.from("media").remove(stale).catch(() => undefined);
  }
  return publicMediaUrl(name);
}

/** Rename the sidecar alongside its video so references stay intact. */
export async function renameLibraryPoster(
  oldVideoName: string,
  newVideoName: string,
  names: Iterable<string>,
): Promise<string | null> {
  const current = findPosterName(oldVideoName, names);
  if (!current) return null;
  const ext = (current.split(".").pop() as PosterExt) || "webp";
  const next = posterNameFor(newVideoName, ext);
  if (next === current) return null;
  await renameMediaFile(current, next);
  return next;
}

/** Delete the sidecar of a video. media-guard refuses when it is still referenced. */
export async function deleteLibraryPoster(
  videoName: string,
  names: Iterable<string>,
): Promise<string | null> {
  const current = findPosterName(videoName, names);
  if (!current) return null;
  const result = await deleteMediaFile(current);
  return result?.deleted ? current : null;
}
