/**
 * Regression cover for the ffmpeg loading/error contract fixed on 2026-08-18.
 *
 * 1. The self-hosted core MUST be the ESM build: @ffmpeg/ffmpeg spawns a `{ type: "module" }`
 *    worker, module workers cannot importScripts(), and importing the UMD build as ESM yields
 *    an empty module — the load then fails with a bare string and the UI showed only
 *    "Processing failed".
 * 2. Every failure the engine can hit must reach the UI as a categorised VideoEngineError
 *    (load / read / encode / output), never as a bare string.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { ffmpegCore } from "../../vite-plugin-ffmpeg-core";

// ---------------------------------------------------------------------------
// 1. Plugin: the emitted core is the ESM build, not the UMD one
// ---------------------------------------------------------------------------
describe("self-hosted ffmpeg core", () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "ffcore-"));
  afterAll(() => fs.rmSync(out, { recursive: true, force: true }));

  it("emits an ESM core with a default export plus a non-empty wasm", () => {
    const plugin = ffmpegCore(process.cwd()) as unknown as {
      configResolved: () => void;
      writeBundle: (o: { dir: string }) => void;
    };
    plugin.configResolved();
    plugin.writeBundle({ dir: out });

    const js = fs.readFileSync(path.join(out, "ffmpeg/ffmpeg-core.js"), "utf8");
    // The whole point of the fix: `import(coreURL)` in a module worker needs a real export.
    expect(js).toMatch(/export\s+default\s+createFFmpegCore/);
    // A UMD build would register itself on the global object instead.
    expect(js).not.toMatch(/typeof exports\s*===?\s*["']object["']/);
    expect(fs.statSync(path.join(out, "ffmpeg/ffmpeg-core.wasm")).size).toBeGreaterThan(1_000_000);
  });
});

// ---------------------------------------------------------------------------
// 2. Engine: categorised errors
// ---------------------------------------------------------------------------
type Behaviour = {
  load?: () => Promise<unknown>;
  exec?: () => Promise<number>;
  readFile?: () => Promise<Uint8Array | string>;
};
let behaviour: Behaviour = {};

vi.mock("@ffmpeg/ffmpeg", () => ({
  FFmpeg: class {
    loaded = false;
    on = () => undefined;
    off = () => undefined;
    async load() {
      if (behaviour.load) return behaviour.load();
      this.loaded = true;
      return true;
    }
    async writeFile() { return true; }
    async exec() { return behaviour.exec ? behaviour.exec() : 0; }
    async readFile() { return behaviour.readFile ? behaviour.readFile() : new Uint8Array([1, 2, 3]); }
    async deleteFile() { return true; }
    terminate() { /* no-op */ }
  },
}));

const CAPS = { h264: true, vp9: true, aac: true, opus: true, mp3lame: true, vorbis: true };
const OPTS = {
  format: "mp4" as const,
  quality: "balanced" as const,
  resolution: "720" as const,
  meta: { width: 1920, height: 1080 },
  caps: CAPS,
};
// A real-world name: spaces must never break the run (the input is renamed to in.<ext>).
const file = (name = "Master Reel 06.mp4") =>
  ({ name, size: 10, arrayBuffer: async () => new Uint8Array([9, 9, 9]).buffer }) as unknown as File;

const engine = async () => {
  const mod = await import("@/lib/video-ffmpeg");
  mod.terminateFFmpeg();
  return mod;
};

beforeEach(() => {
  behaviour = {};
  vi.clearAllMocks();
});

describe("categorised engine errors", () => {
  it("normalises the bare string ffmpeg.wasm throws when the core cannot be imported", async () => {
    // This is exactly what a module worker + UMD core produced: a string, not an Error.
    behaviour.load = async () => { throw "failed to import ffmpeg-core.js"; };
    const { convertVideo } = await engine();
    await expect(convertVideo(file(), OPTS)).rejects.toMatchObject({
      name: "VideoEngineError",
      code: "load",
      message: "failed to import ffmpeg-core.js",
    });
  });

  it("rejects a non-zero ffmpeg exit as an encode failure and never reads the output", async () => {
    behaviour.exec = async () => 1;
    behaviour.readFile = async () => { throw new Error("readFile must not be called"); };
    const { convertVideo } = await engine();
    await expect(convertVideo(file(), OPTS)).rejects.toMatchObject({ code: "encode" });
  });

  it("rejects an empty result as an output failure instead of uploading 0 bytes", async () => {
    behaviour.readFile = async () => new Uint8Array([]);
    const { convertVideo } = await engine();
    await expect(convertVideo(file(), OPTS)).rejects.toMatchObject({ code: "output" });
  });

  it("categorises an exec throw as encode and a readFile throw as output", async () => {
    const { convertVideo } = await engine();
    behaviour.exec = async () => { throw "core panicked"; };
    await expect(convertVideo(file(), OPTS)).rejects.toMatchObject({ code: "encode", message: "core panicked" });

    behaviour = { readFile: async () => { throw new Error("ENOENT"); } };
    const again = await engine();
    await expect(again.convertVideo(file(), OPTS)).rejects.toMatchObject({ code: "output" });
  });

  it("keeps an abort an AbortError — never re-categorised", async () => {
    const { convertVideo } = await engine();
    const c = new AbortController();
    c.abort();
    await expect(convertVideo(file(), OPTS, { signal: c.signal })).rejects.toMatchObject({ name: "AbortError" });
  });

  it("succeeds on a plain H.264/AAC file whose name contains spaces", async () => {
    const { convertVideo } = await engine();
    const out = await convertVideo(file(), OPTS);
    expect(out.size).toBe(3);
  });
});
