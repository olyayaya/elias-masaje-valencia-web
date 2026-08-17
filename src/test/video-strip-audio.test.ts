/**
 * stripAudio runtime: a real remux run against a mocked ffmpeg core. Lives in its own file
 * because the Library UI test mocks the whole video-ffmpeg module.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// runtime: cleanup of the wasm virtual FS
// ---------------------------------------------------------------------------
const calls: string[] = [];
const ff = {
  loaded: true,
  writeFile: vi.fn(async () => { calls.push("write"); return true; }),
  exec: vi.fn(async (a: string[]) => { calls.push(`exec:${a.join(" ")}`); return 0; }),
  readFile: vi.fn(async () => new Uint8Array([1, 2, 3])),
  deleteFile: vi.fn(async (n: string) => { calls.push(`delete:${n}`); return true; }),
  terminate: vi.fn(() => { calls.push("terminate"); }),
  on: vi.fn(),
  off: vi.fn(),
  load: vi.fn(async () => true),
};
vi.mock("@ffmpeg/ffmpeg", () => ({
  FFmpeg: class {
    loaded = false;
    on = (e: string, cb: unknown) => ff.on(e, cb);
    off = (e: string, cb: unknown) => ff.off(e, cb);
    async load() { Object.assign(this, ff); this.loaded = true; return true; }
  },
}));

const videoFile = (name = "clip.mp4") =>
  ({ name, size: 10, type: "video/mp4", arrayBuffer: async () => new Uint8Array([7]).buffer }) as unknown as File;

const deleted = () => calls.filter((c) => c.startsWith("delete:")).map((c) => c.slice(7));

describe("stripAudio runtime", () => {
  beforeEach(() => { calls.length = 0; vi.clearAllMocks(); });

  it("remuxes and always clears the temporary files", async () => {
    const { stripAudio, terminateFFmpeg } = await import("@/lib/video-ffmpeg");
    terminateFFmpeg();
    const out = await stripAudio(videoFile(), { fileName: "clip.mp4", mimeType: "video/mp4" });
    expect(out.size).toBeGreaterThan(0);
    expect(out.blob.type).toBe("video/mp4");
    expect(calls.some((c) => c.startsWith("exec:") && c.includes("-an"))).toBe(true);
    const files = deleted();
    expect(files).toHaveLength(2);
    expect(files.every((f) => /^mute-[a-z0-9-]+-(in|out)\.mp4$/.test(f))).toBe(true);
  });

  it("uses a distinct temporary name for every operation", async () => {
    const { stripAudio, terminateFFmpeg } = await import("@/lib/video-ffmpeg");
    terminateFFmpeg();
    await stripAudio(videoFile(), { fileName: "clip.mp4", mimeType: "video/mp4" });
    const first = deleted();
    calls.length = 0;
    await stripAudio(videoFile(), { fileName: "clip.mp4", mimeType: "video/mp4" });
    expect(deleted()).not.toEqual(first);
  });

  it("rejects on a non-zero ffmpeg exit code without reading the output", async () => {
    const { stripAudio, terminateFFmpeg } = await import("@/lib/video-ffmpeg");
    terminateFFmpeg();
    ff.exec.mockImplementationOnce(async (a: string[]) => { calls.push(`exec:${a.join(" ")}`); return 1; });
    await expect(stripAudio(videoFile(), { fileName: "clip.mp4", mimeType: "video/mp4" }))
      .rejects.toThrow(/exit code 1/);
    expect(ff.readFile).not.toHaveBeenCalled();
    expect(deleted()).toHaveLength(2);
    expect(ff.off).toHaveBeenCalled();
  });

  it("still deletes the input when the remux fails", async () => {
    const { stripAudio, terminateFFmpeg } = await import("@/lib/video-ffmpeg");
    terminateFFmpeg();
    ff.exec.mockImplementationOnce(async () => { throw new Error("boom"); });
    await expect(stripAudio(videoFile(), { fileName: "clip.mp4", mimeType: "video/mp4" })).rejects.toThrow(/boom/);
    expect(deleted().some((f) => f.endsWith("-in.mp4"))).toBe(true);
  });

  it("rejects an already-aborted request without running ffmpeg", async () => {
    const { stripAudio } = await import("@/lib/video-ffmpeg");
    const c = new AbortController();
    c.abort();
    await expect(
      stripAudio(videoFile(), { fileName: "clip.mp4", mimeType: "video/mp4" }, { signal: c.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(calls).toEqual([]);
  });
});

