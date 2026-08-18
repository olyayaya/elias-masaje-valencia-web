/**
 * Out-of-memory handling for the browser converter.
 * A wasm heap exhaustion must be categorised as "memory" (never shown raw to the admin),
 * must tear the core down so the next attempt starts clean, and two runs must never share
 * the single wasm heap at the same time.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildFfmpegArgs,
  exceedsMemoryBudget,
  isMobileBrowser,
  memorySafeSettings,
  type EncoderCaps,
} from "@/lib/video-convert";

const CAPS: EncoderCaps = { h264: true, vp9: true, aac: true, opus: true, mp3lame: false, vorbis: false };

const load = vi.fn(async () => true);
const exec = vi.fn(async () => 0);
const writeFile = vi.fn(async () => true);
const readFile = vi.fn(async () => new Uint8Array([1, 2, 3]));
const deleteFile = vi.fn(async () => true);
const terminate = vi.fn();

vi.mock("@ffmpeg/ffmpeg", () => ({
  FFmpeg: class {
    loaded = true;
    load = load;
    exec = exec;
    writeFile = writeFile;
    readFile = readFile;
    deleteFile = deleteFile;
    terminate = terminate;
    on = vi.fn();
    off = vi.fn();
  },
}));

const file = () => new File([new Uint8Array(64)], "clip.mp4", { type: "video/mp4" });
const options = {
  format: "webm" as const,
  quality: "balanced" as const,
  resolution: "original" as const,
  meta: { width: 1080, height: 1920 },
  caps: CAPS,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("memory policy (pure)", () => {
  it("flags 1080x1920 WebM as over budget on mobile but not on desktop", () => {
    expect(exceedsMemoryBudget({ width: 1080, height: 1920, format: "webm", mobile: true })).toBe(true);
    expect(exceedsMemoryBudget({ width: 1080, height: 1920, format: "webm", mobile: false })).toBe(false);
    expect(exceedsMemoryBudget({ width: 720, height: 1280, format: "webm", mobile: true })).toBe(false);
    // H.264 is far cheaper per pixel: 1080p stays inside the budget.
    expect(exceedsMemoryBudget({ width: 1080, height: 1920, format: "mp4", mobile: true })).toBe(false);
  });

  it("detects iOS user agents", () => {
    expect(isMobileBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari")).toBe(true);
    expect(isMobileBrowser("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome")).toBe(false);
  });

  it("offers MP4 720p as the explicit lighter preset", () => {
    expect(memorySafeSettings(CAPS)).toEqual({ format: "mp4", resolution: "720", customShortSide: 720 });
    expect(memorySafeSettings({ ...CAPS, h264: false })).toEqual({
      format: "webm", resolution: "720", customShortSide: 720,
    });
  });

  it("never emits libvpx options that allocate per-thread or lookahead buffers", () => {
    const a = buildFfmpegArgs({ ...options, inputName: "in.mp4", outputName: "out.webm" });
    expect(a[a.indexOf("-lag-in-frames") + 1]).toBe("0");
    expect(a[a.indexOf("-auto-alt-ref") + 1]).toBe("0");
    expect(a[a.indexOf("-row-mt") + 1]).toBe("0");
    expect(a[a.indexOf("-threads") + 1]).toBe("1");
  });
});

describe("engine failure handling", () => {
  it("categorises a wasm out-of-bounds abort as 'memory' and drops the core", async () => {
    const engine = await import("@/lib/video-ffmpeg");
    exec.mockRejectedValueOnce(new WebAssembly.RuntimeError("Out of bounds memory access"));
    const err = await engine.convertVideo(file(), options).catch((e) => e);
    expect(err.name).toBe("VideoEngineError");
    expect(err.code).toBe("memory");
    // The heap is unusable after an abort — the singleton must be gone.
    expect(engine.hasLoadedCore()).toBe(false);
    expect(terminate).toHaveBeenCalled();
  });

  it("still categorises a plain string OOM abort", async () => {
    const engine = await import("@/lib/video-ffmpeg");
    exec.mockRejectedValueOnce("Aborted(OOM). Build with -sASSERTIONS");
    const err = await engine.convertVideo(file(), options).catch((e) => e);
    expect(err.code).toBe("memory");
  });

  it("refuses a second concurrent run instead of sharing the heap", async () => {
    const engine = await import("@/lib/video-ffmpeg");
    let release: () => void = () => {};
    exec.mockImplementationOnce(() => new Promise<number>((r) => { release = () => r(0); }));
    const first = engine.convertVideo(file(), options);
    const err = await engine.convertVideo(file(), options).catch((e) => e);
    expect(err.code).toBe("busy");
    release();
    await first;
    expect(engine.isConverterBusy()).toBe(false);
  });

  it("releases the busy flag after a failure so a retry is possible", async () => {
    const engine = await import("@/lib/video-ffmpeg");
    exec.mockRejectedValueOnce(new WebAssembly.RuntimeError("Out of bounds memory access"));
    await engine.convertVideo(file(), options).catch(() => {});
    expect(engine.isConverterBusy()).toBe(false);
    const out = await engine.convertVideo(file(), options);
    expect(out.size).toBeGreaterThan(0);
  });
});
