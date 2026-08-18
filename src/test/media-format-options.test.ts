/**
 * The Format dropdowns must offer every container the runtime can really produce:
 * WebP for photos, MP4/MOV/WebM for videos (WebM only with a real VP9 + Opus/Vorbis core).
 */
import { describe, it, expect } from "vitest";
import { availablePhotoFormats } from "@/lib/photo-encode";
import { availableFormatsWithMov, buildFfmpegArgs, type EncoderCaps } from "@/lib/video-convert";

const caps = (o: Partial<EncoderCaps> = {}): EncoderCaps => ({
  h264: true, vp9: true, aac: true, opus: true, mp3lame: false, vorbis: false, ...o,
});

describe("format options", () => {
  it("offers WebP whenever the browser can encode it", () => {
    expect(availablePhotoFormats({ webp: true, jpg: true, png: true })).toContain("webp");
    expect(availablePhotoFormats({ webp: false, jpg: true, png: true })).not.toContain("webp");
  });

  it("offers MP4, MOV and WebM when the core has the encoders", () => {
    expect(availableFormatsWithMov(caps())).toEqual(["mp4", "mov", "webm"]);
    expect(availableFormatsWithMov(caps({ vp9: false }))).not.toContain("webm");
    expect(availableFormatsWithMov(caps({ opus: false, vorbis: true }))).toContain("webm");
  });

  it("really converts to WebM with VP9 + Opus, not just as a label", () => {
    const args = buildFfmpegArgs({
      inputName: "in.mp4", outputName: "out.webm", format: "webm", quality: "balanced",
      resolution: "original", meta: { width: 1920, height: 1080 }, caps: caps(),
    });
    expect(args).toContain("libvpx-vp9");
    expect(args).toContain("libopus");
    expect(args.at(-1)).toBe("out.webm");
  });
});
