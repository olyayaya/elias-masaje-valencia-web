/**
 * Capability flags for the media-guard Edge Function that is ACTUALLY deployed.
 *
 * The manual-replace capable media-guard (explicit `mode: "manual"` replaces, MOV output
 * refusal, published-gallery guard) IS deployed, so an admin-confirmed replacement is
 * allowed even when the result is not smaller. Only the saving threshold is bypassed —
 * auth, name, MIME/magic-byte, size and transactional reference rewrites all still apply.
 */

import { isGalleryPublishable } from "./video-convert";

/** The live function honours an explicit `mode: "manual"` replace. */
export const BACKEND_SUPPORTS_MANUAL_REPLACE = true;

/** Containers the live function accepts as a video replacement (`ALLOWED_VIDEO_OUTPUT`). */
export const REPLACE_VIDEO_FORMATS = ["mp4", "webm"] as const;

export type ReplaceBlockReason = "movReplaceBlocked" | "movGalleryBlocked";

export type ReplaceGate = { allowed: true } | { allowed: false; reason: ReplaceBlockReason };


/**
 * Decides whether a produced result may replace an existing library object.
 * Applies only to replacements — a brand new upload is unaffected.
 * The saving threshold is NOT a gate: an admin-confirmed replace runs in manual mode.
 */
export function replaceGate(args: {
  kind: "photo" | "video";
  outputName: string;
  publishedInGallery?: boolean;
}): ReplaceGate {
  if (args.kind === "video" && !isGalleryPublishable(args.outputName)) {
    // MOV is blocked for every replacement; a published gallery item gets the sharper reason.
    return { allowed: false, reason: args.publishedInGallery ? "movGalleryBlocked" : "movReplaceBlocked" };
  }
  return { allowed: true };

}
