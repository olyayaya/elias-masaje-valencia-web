/**
 * The Format dropdowns must offer exactly the containers we can really publish:
 * WebP for photos, MP4/MOV for videos. WebM/VP9 is NOT offered — libvpx-vp9 crashes the
 * browser renderer in this wasm core — while WebM sources stay readable as input.
 */
import { describe, it, expect } from "vitest";
import { availablePhotoFormats } from "@/lib/photo-encode";
import {
  availableFormats, availableFormatsWithMov, smartPreset, type EncoderCaps,
} from "@/lib/video-convert";
import { VIDEO_INPUT_EXTS } from "@/lib/media-kind";

const caps = (o: Partial<EncoderCaps> = {}): EncoderCaps => ({
  h264: true, vp9: true, aac: true, opus: true, mp3lame: false, vorbis: false, ...o,
});

describe("format options", () => {
  it("offers WebP whenever the browser can encode it", () => {
    expect(availablePhotoFormats({ webp: true, jpg: true, png: true })).toContain("webp");
    expect(availablePhotoFormats({ webp: false, jpg: true, png: true })).not.toContain("webp");
  });

  it("offers MP4 and MOV, never WebM, even when the core has VP9 + Opus", () => {
    expect(availableFormatsWithMov(caps())).toEqual(["mp4", "mov"]);
    expect(availableFormatsWithMov(caps({ opus: false, vorbis: true }))).not.toContain("webm");
    expect(availableFormats(caps())).toEqual(["mp4"]);
  });

  it("Smart always picks MP4/H.264, and nothing at all without H.264", () => {
    const meta = { width: 1080, height: 1920, duration: 4, size: 8 * 1024 * 1024 };
    expect(smartPreset(meta, caps())?.format).toBe("mp4");
    expect(smartPreset(meta, caps({ h264: false }))).toBeNull();
  });

  it("still accepts WebM (and MOV) as an input container", () => {
    expect(VIDEO_INPUT_EXTS).toContain("webm");
    expect(VIDEO_INPUT_EXTS).toContain("mov");
  });
});

describe("upload the original without conversion", () => {
  it("keeps the source MIME/extension and only allows a safe stream-copy remux", async () => {
    const { canRemuxWithoutReencode, originalContentType } = await import("@/lib/video-convert");
    expect(originalContentType("clip.mov", "")).toBe("video/quicktime");
    expect(originalContentType("clip.mp4", "video/mp4")).toBe("video/mp4");
    expect(canRemuxWithoutReencode("clip.mov")).toBe(true);
    expect(canRemuxWithoutReencode("clip.webm")).toBe(true);
    expect(canRemuxWithoutReencode("clip.avi")).toBe(false);
  });
});
