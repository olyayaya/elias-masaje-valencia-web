/**
 * The Library must never promise a replacement the DEPLOYED media-guard would refuse.
 * The manual-capable media-guard is deployed, so the saving threshold no longer gates a
 * confirmed replace — only the container policy and the Gallery guard still do.
 */
import { describe, it, expect } from "vitest";
import { BACKEND_SUPPORTS_MANUAL_REPLACE, replaceGate } from "@/lib/media-backend";

describe("replace gate", () => {
  it("allows a photo replacement regardless of the saving verdict", () => {
    expect(replaceGate({ kind: "photo", outputName: "hero.webp" })).toEqual({ allowed: true });
  });

  it("allows a bigger result now that manual replacement is deployed", () => {
    expect(replaceGate({ kind: "photo", outputName: "hero.png" })).toEqual({ allowed: true });
  });

  it("allows a web-safe video replacement", () => {
    expect(replaceGate({ kind: "video", outputName: "clip.webm" })).toEqual({ allowed: true });
  });

  it("never replaces with MOV, and explains gallery items sharply", () => {
    expect(replaceGate({ kind: "video", outputName: "clip.mov" }))
      .toEqual({ allowed: false, reason: "movReplaceBlocked" });
    expect(replaceGate({ kind: "video", outputName: "clip.mov", publishedInGallery: true }))
      .toEqual({ allowed: false, reason: "movGalleryBlocked" });
  });

  it("reports the deployed manual-replace capability", () => {
    expect(BACKEND_SUPPORTS_MANUAL_REPLACE).toBe(true);
  });
});
