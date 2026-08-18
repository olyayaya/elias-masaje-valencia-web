/**
 * The Library must never promise a replacement the DEPLOYED media-guard would refuse.
 * These are pure checks on the gate that the processing dialog consults before Apply.
 */
import { describe, it, expect } from "vitest";
import { BACKEND_SUPPORTS_MANUAL_REPLACE, replaceGate } from "@/lib/media-backend";

describe("replace gate", () => {
  it("allows a photo replacement that clears the server saving rule", () => {
    expect(replaceGate({ kind: "photo", outputName: "hero.webp", savingOk: true })).toEqual({ allowed: true });
  });

  it("blocks a bigger result while the deployed function still enforces savings", () => {
    expect(replaceGate({ kind: "photo", outputName: "hero.webp", savingOk: false, manualSupported: false }))
      .toEqual({ allowed: false, reason: "manualUnavailable" });
  });

  it("allows a forced replacement once the manual-capable function is deployed", () => {
    expect(replaceGate({ kind: "photo", outputName: "hero.webp", savingOk: false, manualSupported: true }))
      .toEqual({ allowed: true });
  });

  it("never replaces with MOV, and explains gallery items sharply", () => {
    expect(replaceGate({ kind: "video", outputName: "clip.mov", savingOk: true }))
      .toEqual({ allowed: false, reason: "movReplaceBlocked" });
    expect(replaceGate({ kind: "video", outputName: "clip.mov", savingOk: true, publishedInGallery: true }))
      .toEqual({ allowed: false, reason: "movGalleryBlocked" });
  });

  it("keeps the manual flag off until the new media-guard ships", () => {
    expect(BACKEND_SUPPORTS_MANUAL_REPLACE).toBe(false);
  });
});
