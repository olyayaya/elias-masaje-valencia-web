import { describe, it, expect, vi, beforeEach } from "vitest";
import { classifyUpload, UPLOAD_ACCEPT } from "@/lib/media-kind";
import { optStateOf } from "@/lib/media-filters";
import { promoteSameName, type PromoteStorage } from "../../supabase/functions/media-guard/promote";
import {
  validateStagedName,
  validateVideoSourceName,
  stagedNameFor,
} from "../../supabase/functions/media-guard/rules";

// ---------------------------------------------------------------------------
// convertVideo lifecycle (mock ffmpeg — no wasm involved)
// ---------------------------------------------------------------------------
const calls: string[] = [];
const ff = {
  loaded: true,
  writeFile: vi.fn(async () => {
    calls.push("write:start");
    await new Promise((r) => setTimeout(r, 10));
    calls.push("write:end");
    return true;
  }),
  exec: vi.fn(async () => { calls.push("exec"); return 0; }),
  readFile: vi.fn(async () => new Uint8Array([1, 2, 3])),
  deleteFile: vi.fn(async (n: string) => { calls.push(`delete:${n}`); return true; }),
  terminate: vi.fn(() => { calls.push("terminate"); }),
  on: vi.fn(),
  off: vi.fn(() => { calls.push("off"); }),
  load: vi.fn(async () => true),
};

let loadDelay = 0;
vi.mock("@ffmpeg/ffmpeg", () => ({
  FFmpeg: class {
    loaded = false;
    on = (...a: unknown[]) => ff.on(...a);
    off = (...a: unknown[]) => ff.off(...a);
    async load() {
      await new Promise((r) => setTimeout(r, loadDelay));
      Object.assign(this, ff);
      this.loaded = true;
      return true;
    }
  },
}));

const fakeFile = () =>
  ({
    name: "clip.mov",
    size: 10,
    arrayBuffer: async () => new Uint8Array([9, 9, 9]).buffer,
  }) as unknown as File;

const CAPS = { h264: true, vp9: true, aac: true, opus: true, mp3lame: true, vorbis: true };
const OPTS = {
  format: "mp4" as const,
  quality: "balanced" as const,
  resolution: "720" as const,
  meta: { width: 1920, height: 1080 },
  caps: CAPS,
};

beforeEach(() => {
  calls.length = 0;
  loadDelay = 0;
  vi.clearAllMocks();
});

describe("convertVideo lifecycle", () => {
  it("finishes writing the input before ffmpeg is executed", async () => {
    const { convertVideo, terminateFFmpeg } = await import("@/lib/video-ffmpeg");
    terminateFFmpeg();
    const out = await convertVideo(fakeFile(), OPTS);
    expect(out.size).toBeGreaterThan(0);
    // A missing await would interleave these — exec must come after write:end.
    expect(calls.indexOf("write:end")).toBeLessThan(calls.indexOf("exec"));
    // Both virtual FS entries are removed on the happy path.
    expect(calls).toContain("delete:in.mov");
    expect(calls).toContain("delete:out.mp4");
  });

  it("never starts encoding when cancelled while the core is still loading", async () => {
    const { convertVideo, terminateFFmpeg } = await import("@/lib/video-ffmpeg");
    terminateFFmpeg();
    loadDelay = 30;
    const controller = new AbortController();
    const promise = convertVideo(fakeFile(), OPTS, { signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(calls).not.toContain("exec");
    expect(calls).not.toContain("write:start");
  });

  it("rejects immediately for an already-aborted signal", async () => {
    const { convertVideo } = await import("@/lib/video-ffmpeg");
    const controller = new AbortController();
    controller.abort();
    await expect(convertVideo(fakeFile(), OPTS, { signal: controller.signal })).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(calls).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Upload allowlist
// ---------------------------------------------------------------------------
describe("upload allowlist", () => {
  it("accepts only the four promised video containers", () => {
    for (const [name, type] of [
      ["a.mp4", "video/mp4"],
      ["a.mov", "video/quicktime"],
      ["a.m4v", "video/x-m4v"],
      ["a.webm", "video/webm"],
    ]) {
      expect(classifyUpload({ name, type })).toMatchObject({ ok: true, kind: "video" });
    }
  });

  it("rejects other video formats even with a video/* MIME", () => {
    expect(classifyUpload({ name: "a.avi", type: "video/x-msvideo" }).ok).toBe(false);
    expect(classifyUpload({ name: "a.mkv", type: "video/x-matroska" }).ok).toBe(false);
    expect(classifyUpload({ name: "a.exe", type: "video/mp4" }).ok).toBe(false);
  });

  it("rejects a MIME that contradicts the extension", () => {
    expect(classifyUpload({ name: "a.mp4", type: "image/png" }).ok).toBe(false);
    expect(classifyUpload({ name: "a.png", type: "video/mp4" }).ok).toBe(false);
  });

  it("accepts photos and normalizes the video MIME from the extension", () => {
    expect(classifyUpload({ name: "a.PNG", type: "image/png" })).toEqual({ ok: true, kind: "photo" });
    expect(classifyUpload({ name: "a.MOV", type: "" })).toMatchObject({ mimeType: "video/quicktime" });
  });

  it("never advertises a blanket video/* accept", () => {
    expect(UPLOAD_ACCEPT).not.toContain("video/*");
    expect(UPLOAD_ACCEPT).toContain(".m4v");
  });
});

// ---------------------------------------------------------------------------
// Staged / source naming rules (server side)
// ---------------------------------------------------------------------------
const USER = "11111111-2222-3333-4444-555555555555";
const OTHER = "99999999-2222-3333-4444-555555555555";

describe("staged object rules", () => {
  const staged = stagedNameFor(USER, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "mp4");

  it("accepts a well-formed, user-bound staged name", () => {
    expect(validateStagedName(staged, USER, ["clip.mp4", "clip.webm"])).toBeNull();
  });

  it("refuses staged objects belonging to another user", () => {
    expect(validateStagedName(staged, OTHER, [])).toMatch(/does not belong/);
  });

  it("refuses non-staged, path-y or colliding names", () => {
    expect(validateStagedName("clip.mp4", USER, [])).toMatch(/Invalid/);
    expect(validateStagedName(`../${staged}`, USER, [])).toMatch(/Invalid/);
    expect(validateStagedName(staged, USER, [staged])).toMatch(/collides/);
  });

  it("only accepts supported source containers", () => {
    expect(validateVideoSourceName("clip.mp4")).toBeNull();
    expect(validateVideoSourceName("clip.m4v")).toBeNull();
    expect(validateVideoSourceName("clip.avi")).toMatch(/Unsupported video source/);
  });
});

// ---------------------------------------------------------------------------
// Same-name promotion + rollback
// ---------------------------------------------------------------------------
function fakeStorage(objects: string[], fail: Partial<{ copy: string; remove: string }> = {}) {
  const set = new Set(objects);
  const storage: PromoteStorage = {
    copy: async (from, to) => {
      if (fail.copy && to.startsWith(fail.copy)) return { error: { message: "copy boom" } };
      if (!set.has(from)) return { error: { message: `missing ${from}` } };
      set.add(to);
      return { error: null };
    },
    remove: async (names) => {
      if (fail.remove && names.some((n) => n.startsWith(fail.remove!))) return { error: { message: "remove boom" } };
      names.forEach((n) => set.delete(n));
      return { error: null };
    },
  };
  return { storage, set };
}

describe("same-name video promotion", () => {
  const opts = { staged: "staged-x.mp4", target: "clip.mp4", backup: "backup-x-clip.mp4" };

  it("swaps the object and cleans up on success", async () => {
    const { storage, set } = fakeStorage(["clip.mp4", "staged-x.mp4"]);
    expect(await promoteSameName(storage, opts)).toEqual({ ok: true });
    expect([...set]).toEqual(["clip.mp4"]);
  });

  it("restores the original when the promotion copy fails", async () => {
    // Only the staged→target copy fails: the backup copy already happened.
    let seen = 0;
    const { set } = fakeStorage(["clip.mp4", "staged-x.mp4"]);
    const storage: PromoteStorage = {
      copy: async (from, to) => {
        if (from === "staged-x.mp4") { seen++; return { error: { message: "copy boom" } }; }
        set.add(to);
        return { error: null };
      },
      remove: async (names) => { names.forEach((n) => set.delete(n)); return { error: null }; },
    };
    const res = await promoteSameName(storage, opts);
    expect(seen).toBe(1);
    expect(res).toMatchObject({ ok: false, restored: true });
    // The public URL still resolves: the original object exists again.
    expect(set.has("clip.mp4")).toBe(true);
    expect(set.has("backup-x-clip.mp4")).toBe(false);
  });

  it("keeps the backup and the staged upload when even the restore fails", async () => {
    const set = new Set(["clip.mp4", "staged-x.mp4"]);
    const storage: PromoteStorage = {
      copy: async (from, to) => {
        if (from === "clip.mp4") { set.add(to); return { error: null }; }
        return { error: { message: "copy boom" } };
      },
      remove: async (names) => { names.forEach((n) => set.delete(n)); return { error: null }; },
    };
    const res = await promoteSameName(storage, opts);
    expect(res).toMatchObject({ ok: false, restored: false, stagedKept: true });
    expect(set.has("backup-x-clip.mp4")).toBe(true);
    expect(set.has("staged-x.mp4")).toBe(true);
  });

  it("never deletes the original when the backup itself fails", async () => {
    const { storage, set } = fakeStorage(["clip.mp4", "staged-x.mp4"], { copy: "backup-" });
    const res = await promoteSameName(storage, opts);
    expect(res.ok).toBe(false);
    expect(set.has("clip.mp4")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Optimization state
// ---------------------------------------------------------------------------
describe("optimization state", () => {
  const f = (name: string, mimeType?: string) => ({ name, size: 1, url: "", created_at: "", mimeType });

  it("marks non-media as unsupported without analysis", () => {
    expect(optStateOf(f("notes.pdf", "application/pdf"), {})).toBe("unsupported");
  });

  it("keeps photos and videos analyzable until measured", () => {
    expect(optStateOf(f("a.webp", "image/webp"), {})).toBe("notAnalyzed");
    expect(optStateOf(f("a.mp4", "video/mp4"), {})).toBe("notAnalyzed");
    expect(optStateOf(f("a.mp4", "video/mp4"), { "a.mp4": "canOptimize" })).toBe("canOptimize");
  });
});
