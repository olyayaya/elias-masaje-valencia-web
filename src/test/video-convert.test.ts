import { describe, it, expect } from "vitest";
import {
  availableFormats,
  buildFfmpegArgs,
  evaluateVideoSaving,
  outputNameFor,
  parseEncoderCaps,
  smartPreset,
  targetDimensions,
  type EncoderCaps,
} from "@/lib/video-convert";
import {
  ALLOWED_VIDEO_OUTPUT,
  validateVideoOutputType,
  videoMagicMatches,
  MAX_VIDEO_BYTES,
} from "../../supabase/functions/media-guard/rules";

const FULL: EncoderCaps = { h264: true, vp9: true, aac: true, opus: true, mp3lame: true, vorbis: true };
const NONE: EncoderCaps = { h264: false, vp9: false, aac: false, opus: false, mp3lame: false, vorbis: false };

describe("resolution policy", () => {
  it("never upscales", () => {
    expect(targetDimensions(640, 360, "1080")).toEqual({ width: 640, height: 360 });
    expect(targetDimensions(640, 360, "original")).toEqual({ width: 640, height: 360 });
  });

  it("scales on the short side and keeps the aspect ratio", () => {
    expect(targetDimensions(3840, 2160, "1080")).toEqual({ width: 1920, height: 1080 });
    // portrait: 1080 applies to the width
    expect(targetDimensions(2160, 3840, "1080")).toEqual({ width: 1080, height: 1920 });
  });

  it("always produces even dimensions", () => {
    const { width, height } = targetDimensions(1919, 1081, "720");
    expect(width % 2).toBe(0);
    expect(height % 2).toBe(0);
  });
});

describe("ffmpeg argument building", () => {
  const base = {
    inputName: "in.mov",
    outputName: "out.mp4",
    quality: "balanced" as const,
    resolution: "720" as const,
    meta: { width: 1920, height: 1080 },
    caps: FULL,
  };

  it("writes a web-ready mp4 with faststart and yuv420p", () => {
    const args = buildFfmpegArgs({ ...base, format: "mp4" });
    expect(args).toContain("libx264");
    expect(args).toContain("+faststart");
    expect(args).toContain("yuv420p");
    expect(args.join(" ")).toContain("scale=1280:720");
    expect(args.at(-1)).toBe("out.mp4");
  });

  it("writes vp9 + opus for webm", () => {
    const args = buildFfmpegArgs({ ...base, format: "webm", outputName: "out.webm" });
    expect(args).toContain("libvpx-vp9");
    expect(args).toContain("libopus");
  });

  it("falls back to a verified audio encoder when the preferred one is missing", () => {
    const args = buildFfmpegArgs({ ...base, format: "mp4", caps: { ...FULL, aac: false } });
    expect(args).toContain("libmp3lame");
    expect(args).not.toContain("aac");
    const webm = buildFfmpegArgs({ ...base, format: "webm", outputName: "out.webm", caps: { ...FULL, opus: false } });
    expect(webm).toContain("libvorbis");
  });

  it("drops audio instead of naming an encoder the core cannot write", () => {
    const args = buildFfmpegArgs({
      ...base,
      format: "mp4",
      caps: { ...FULL, aac: false, mp3lame: false },
    });
    expect(args).toContain("-an");
    expect(args).not.toContain("-c:a");
  });

  it("caps the frame rate without ever raising it", () => {
    const args = buildFfmpegArgs({ ...base, format: "mp4" });
    // -fpsmax is a ceiling; -r would force-resample a 24 fps source up to 30.
    expect(args).not.toContain("-r");
    expect(args[args.indexOf("-fpsmax") + 1]).toBe("30");
  });
});

describe("capability gating", () => {
  it("only offers formats whose encoder exists", () => {
    expect(availableFormats(FULL)).toEqual(["mp4", "webm"]);
    expect(availableFormats({ ...FULL, h264: false })).toEqual(["webm"]);
    expect(availableFormats(NONE)).toEqual([]);
  });

  it("parses the real -encoders listing", () => {
    const log = [
      "Encoders:",
      " V..... libx264              libx264 H.264 / AVC",
      " V..... libvpx-vp9           libvpx VP9",
      " A..... aac                  AAC (Advanced Audio Coding)",
      " A..... libvorbis            libvorbis",
    ].join("\n");
    expect(parseEncoderCaps(log)).toEqual({
      h264: true, vp9: true, aac: true, opus: false, mp3lame: false, vorbis: true,
    });
  });

  it("returns no preset when nothing can be encoded", () => {
    expect(smartPreset({ width: 1920, height: 1080, duration: 10, size: 10 }, NONE)).toBeNull();
  });

  it("recommends 1080p mp4 and pushes harder on bloated sources", () => {
    const big = smartPreset({ width: 3840, height: 2160, duration: 10, size: 200 * 1024 * 1024 }, FULL);
    expect(big).toEqual({ format: "mp4", resolution: "1080", quality: "small" });
    const modest = smartPreset({ width: 1280, height: 720, duration: 60, size: 20 * 1024 * 1024 }, FULL);
    expect(modest).toEqual({ format: "mp4", resolution: "original", quality: "balanced" });
  });
});

describe("saving threshold", () => {
  it("rejects a bigger or barely smaller result", () => {
    expect(evaluateVideoSaving(1000, 1200)).toMatchObject({ ok: false, reason: "notSmaller" });
    expect(evaluateVideoSaving(10 * 1024 * 1024, 9.8 * 1024 * 1024)).toMatchObject({ ok: false, reason: "alreadyOptimized" });
  });

  it("accepts a real saving", () => {
    const v = evaluateVideoSaving(10 * 1024 * 1024, 4 * 1024 * 1024);
    expect(v).toMatchObject({ ok: true, savedPercent: 60 });
  });
});

describe("output naming", () => {
  it("swaps the container extension", () => {
    expect(outputNameFor("1739-clip.mov", "mp4")).toBe("1739-clip.mp4");
    expect(outputNameFor("1739-clip.mp4", "webm")).toBe("1739-clip.webm");
  });
});

describe("server-side video rules", () => {
  it("only allows mp4/webm outputs with matching extensions", () => {
    expect(Object.keys(ALLOWED_VIDEO_OUTPUT).sort()).toEqual(["video/mp4", "video/webm"]);
    expect(validateVideoOutputType("video/mp4", "a.mp4")).toBeNull();
    expect(validateVideoOutputType("video/webm", "a.webm")).toBeNull();
    expect(validateVideoOutputType("video/mp4", "a.webm")).toMatch(/does not match/);
    expect(validateVideoOutputType("video/quicktime", "a.mov")).toMatch(/Unsupported/);
    expect(validateVideoOutputType("image/png", "a.png")).toMatch(/Unsupported/);
  });

  it("sniffs real container magic bytes", () => {
    const mp4 = new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0]);
    const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3]);
    expect(videoMagicMatches("video/mp4", mp4)).toBe(true);
    expect(videoMagicMatches("video/webm", webm)).toBe(true);
    // A renamed file cannot pass as another container.
    expect(videoMagicMatches("video/mp4", webm)).toBe(false);
    expect(videoMagicMatches("video/webm", mp4)).toBe(false);
    // Not a video at all.
    expect(videoMagicMatches("video/mp4", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(false);
  });

  it("bounds the committed object size", () => {
    expect(MAX_VIDEO_BYTES).toBe(250 * 1024 * 1024);
  });
});
