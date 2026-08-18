/**
 * Exact ffmpeg argv for the advanced video settings offered in Dashboard → Library.
 * These assertions pin the mutually-exclusive rate control, the fps ceiling, the speed
 * presets and the audio policy — the knobs an operator can actually change.
 */
import { describe, it, expect } from "vitest";
import { buildFfmpegArgs, type ConvertOptions } from "@/lib/video-convert";

const CAPS = { h264: true, vp9: true, aac: true, opus: true, mp3lame: false, vorbis: false };
const META = { width: 1920, height: 1080, fps: 60 };

const args = (o: Partial<ConvertOptions> = {}): string[] =>
  buildFfmpegArgs({
    inputName: "in.mp4",
    outputName: "out.mp4",
    format: "mp4",
    quality: "balanced",
    resolution: "original",
    meta: META,
    caps: CAPS,
    ...o,
  });

const valueAfter = (list: string[], flag: string) => list[list.indexOf(flag) + 1];

describe("container selection", () => {
  it("MP4 uses libx264 with faststart and no mov muxer", () => {
    const a = args({ format: "mp4", outputName: "out.mp4" });
    expect(a.slice(0, 2)).toEqual(["-i", "in.mp4"]);
    expect(valueAfter(a, "-c:v")).toBe("libx264");
    expect(a).toContain("-movflags");
    expect(valueAfter(a, "-movflags")).toBe("+faststart");
    expect(a).not.toContain("-f");
    expect(a.at(-1)).toBe("out.mp4");
  });

  it("MOV reuses the x264 pipeline but forces the mov muxer", () => {
    const a = args({ format: "mov", outputName: "out.mov" });
    expect(valueAfter(a, "-c:v")).toBe("libx264");
    expect(valueAfter(a, "-f")).toBe("mov");
    expect(a.at(-1)).toBe("out.mov");
  });

  it("WebM uses libvpx-vp9 with memory-lean settings and never mov flags", () => {
    const a = args({ format: "webm", outputName: "out.webm" });
    expect(valueAfter(a, "-c:v")).toBe("libvpx-vp9");
    // Single-thread wasm core: these are what keep libvpx inside the 32-bit heap on iOS.
    expect(valueAfter(a, "-row-mt")).toBe("0");
    expect(valueAfter(a, "-threads")).toBe("1");
    expect(valueAfter(a, "-lag-in-frames")).toBe("0");
    expect(valueAfter(a, "-auto-alt-ref")).toBe("0");
    expect(valueAfter(a, "-tile-columns")).toBe("0");
    expect(a).not.toContain("-movflags");
    expect(a).not.toContain("-f");
  });

});

describe("rate control is mutually exclusive", () => {
  it("CRF mode emits -crf and no target -b:v for MP4/MOV", () => {
    for (const format of ["mp4", "mov"] as const) {
      const a = args({ format, rate: { mode: "crf", crf: 26 } });
      expect(valueAfter(a, "-crf")).toBe("26");
      expect(a).not.toContain("-b:v");
    }
  });

  it("CRF mode for WebM emits only the documented constant-quality -b:v 0", () => {
    const a = args({ format: "webm", rate: { mode: "crf", crf: 34 }, removeAudio: true });
    expect(valueAfter(a, "-b:v")).toBe("0");
    expect(valueAfter(a, "-crf")).toBe("34");
    // Exactly one -b:v, and it is the VP9 switch — never a bitrate target.
    expect(a.filter((x) => x === "-b:v")).toHaveLength(1);
    // Audio is stripped here, so any "<n>k" token could only be a video bitrate target.
    expect(a.some((x) => /^\d+k$/.test(x))).toBe(false);
  });

  it("bitrate mode emits -b:v in kbit and never -crf", () => {
    const mp4 = args({ rate: { mode: "bitrate", kbps: 2500 } });
    expect(valueAfter(mp4, "-b:v")).toBe("2500k");
    expect(mp4).not.toContain("-crf");
    const webm = args({ format: "webm", rate: { mode: "bitrate", kbps: 1200 } });
    expect(valueAfter(webm, "-b:v")).toBe("1200k");
    expect(webm).not.toContain("-crf");
  });

  it("clamps out-of-range CRF and bitrate instead of trusting the input", () => {
    expect(valueAfter(args({ rate: { mode: "crf", crf: 999 } }), "-crf")).not.toBe("999");
    expect(valueAfter(args({ rate: { mode: "bitrate", kbps: 5 } }), "-b:v")).toBe("150k");
    expect(valueAfter(args({ rate: { mode: "bitrate", kbps: 999999 } }), "-b:v")).toBe("20000k");
  });
});

describe("frame rate", () => {
  it("caps a 60 fps source at the chosen ceiling", () => {
    expect(valueAfter(args({ fps: "30" }), "-fpsmax")).toBe("30");
    expect(valueAfter(args({ fps: "24" }), "-fpsmax")).toBe("24");
  });

  it("leaves an already-slower source alone", () => {
    const a = args({ fps: "30", meta: { width: 1920, height: 1080, fps: 24 } });
    expect(a).not.toContain("-fpsmax");
  });

  it("'original' emits no ceiling at all", () => {
    expect(args({ fps: "original" })).not.toContain("-fpsmax");
  });
});

describe("speed presets", () => {
  it("maps to x264 presets", () => {
    expect(valueAfter(args({ speed: "fast" }), "-preset")).toBe("veryfast");
    expect(valueAfter(args({ speed: "balanced" }), "-preset")).toBe("medium");
    expect(valueAfter(args({ speed: "max" }), "-preset")).toBe("slow");
  });

  it("maps to VP9 -cpu-used (lower = slower, better)", () => {
    expect(valueAfter(args({ format: "webm", speed: "fast" }), "-cpu-used")).toBe("5");
    expect(valueAfter(args({ format: "webm", speed: "balanced" }), "-cpu-used")).toBe("2");
    expect(valueAfter(args({ format: "webm", speed: "max" }), "-cpu-used")).toBe("1");
  });
});

describe("audio", () => {
  it("removeAudio emits -an and no encoder or bitrate", () => {
    const a = args({ removeAudio: true, audioKbps: 192 });
    expect(a).toContain("-an");
    expect(a).not.toContain("-c:a");
    expect(a).not.toContain("-b:a");
  });

  it("keeps the chosen bitrate with the container's encoder", () => {
    const mp4 = args({ removeAudio: false, audioKbps: 96 });
    expect(valueAfter(mp4, "-c:a")).toBe("aac");
    expect(valueAfter(mp4, "-b:a")).toBe("96k");
    const webm = args({ format: "webm", removeAudio: false, audioKbps: 160 });
    expect(valueAfter(webm, "-c:a")).toBe("libopus");
    expect(valueAfter(webm, "-b:a")).toBe("160k");
  });

  it("drops the track rather than naming an encoder the core lacks", () => {
    const a = args({ removeAudio: false, audioKbps: 128, caps: { h264: true, vp9: true, aac: false, opus: false, mp3lame: false, vorbis: false } });
    expect(a).toContain("-an");
    expect(a).not.toContain("-c:a");
  });
});

describe("scaling", () => {
  it("always emits an explicit scale filter for the target size", () => {
    expect(valueAfter(args({ resolution: "720" }), "-vf")).toBe("scale=1280:720");
    expect(valueAfter(args({ resolution: "original" }), "-vf")).toBe("scale=1920:1080");
  });
});
