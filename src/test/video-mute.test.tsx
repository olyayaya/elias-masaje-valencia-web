/**
 * "Remove audio before upload" (Dashboard → Library).
 *
 * The contract under test: when the option is on, the ONLY bytes that reach storage are the
 * locally muted remux — a failure, cancellation or unsupported browser skips the file instead
 * of falling back to the original with sound. Images never touch the video path, and the
 * ffmpeg core stays unloaded while the option is off.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildStripAudioArgs, logHasAudioStream } from "@/lib/video-convert";
import { COPY } from "@/components/dashboard/media/i18n";

// ---------------------------------------------------------------------------
// pure argv / log parsing
// ---------------------------------------------------------------------------
describe("strip-audio ffmpeg command", () => {
  it("copies the video stream and drops audio without re-encoding", () => {
    const args = buildStripAudioArgs({ inputName: "mute-in.mp4", outputName: "mute-out.mp4" });
    expect(args).toEqual([
      "-i", "mute-in.mp4", "-map", "0:v:0", "-c:v", "copy", "-an", "-sn", "-dn",
      "-movflags", "+faststart", "-y", "mute-out.mp4",
    ]);
    // No quality knobs at all: no CRF, no scaling, no video encoder.
    expect(args).not.toContain("-crf");
    expect(args).not.toContain("libx264");
    expect(args).not.toContain("-vf");
  });

  it("keeps the source container and omits mov-only flags for WebM", () => {
    const args = buildStripAudioArgs({ inputName: "mute-in.webm", outputName: "mute-out.webm" });
    expect(args).not.toContain("-movflags");
    expect(args.at(-1)).toBe("mute-out.webm");
  });

  it("detects whether the source had an audio stream", () => {
    expect(logHasAudioStream("Stream #0:1(eng): Audio: aac (LC), 48000 Hz")).toBe(true);
    expect(logHasAudioStream("Stream #0:0: Video: h264 (High)")).toBe(false);
  });
});

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

describe("stripAudio runtime", () => {
  beforeEach(() => { calls.length = 0; vi.clearAllMocks(); });

  it("remuxes and always clears the temporary files", async () => {
    const { stripAudio, terminateFFmpeg } = await import("@/lib/video-ffmpeg");
    terminateFFmpeg();
    const out = await stripAudio(videoFile(), { fileName: "clip.mp4", mimeType: "video/mp4" });
    expect(out.size).toBeGreaterThan(0);
    expect(out.blob.type).toBe("video/mp4");
    expect(calls.some((c) => c.startsWith("exec:") && c.includes("-an"))).toBe(true);
    expect(calls).toContain("delete:mute-in.mp4");
    expect(calls).toContain("delete:mute-out.mp4");
  });

  it("still deletes the input when the remux fails", async () => {
    const { stripAudio, terminateFFmpeg } = await import("@/lib/video-ffmpeg");
    terminateFFmpeg();
    ff.exec.mockImplementationOnce(async () => { throw new Error("boom"); });
    await expect(stripAudio(videoFile(), { fileName: "clip.mp4", mimeType: "video/mp4" })).rejects.toThrow(/boom/);
    expect(calls).toContain("delete:mute-in.mp4");
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

// ---------------------------------------------------------------------------
// Library upload flow
// ---------------------------------------------------------------------------
const toasts: Record<string, unknown[][]> = { success: [], error: [], info: [], warning: [] };
vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => toasts.success.push(a),
    error: (...a: unknown[]) => toasts.error.push(a),
    info: (...a: unknown[]) => toasts.info.push(a),
    warning: (...a: unknown[]) => toasts.warning.push(a),
  },
}));

vi.mock("@/lib/media-usage", () => ({
  checkMediaUsage: vi.fn(),
  checkMediaUsageBatch: vi.fn(),
  deleteMediaFile: vi.fn(),
  renameMediaFile: vi.fn(),
  replaceMediaFile: vi.fn(),
  commitVideoReplacement: vi.fn(),
  MediaGuardError: class extends Error {},
}));

vi.mock("@/components/dashboard/VideoConverterDialog", () => ({ default: () => null }));

const uploadResumable = vi.fn(async () => undefined);
vi.mock("@/lib/video-upload", () => ({
  uploadResumable: (...a: unknown[]) => uploadResumable(...(a as [])),
  removeObject: vi.fn(async () => true),
  stagedObjectName: vi.fn(async () => "staged-x.mp4"),
}));

const imageUpload = vi.fn(async () => ({ error: null }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({
        list: async () => ({ data: [], error: null }),
        getPublicUrl: (n: string) => ({ data: { publicUrl: `https://cdn.test/${n}` } }),
        upload: (...a: unknown[]) => imageUpload(...(a as [])),
        remove: vi.fn(),
      }),
    },
  },
}));

const optimizeImage = vi.fn(async () => ({
  blob: new Blob(["img"]), ext: "webp", mime: "image/webp", originalSize: 100, optimizedSize: 50,
}));
vi.mock("@/lib/image-utils", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  optimizeImage: (...a: unknown[]) => optimizeImage(...(a as [])),
}));

/** The mute helper is the lazy boundary — the Library must only reach it when asked to. */
const stripAudio = vi.fn(async () => ({ blob: new Blob(["muted"], { type: "video/mp4" }), size: 5, hadAudio: true }));
const isConverterSupported = vi.fn(() => true);
vi.mock("@/lib/video-ffmpeg", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  isConverterSupported: () => isConverterSupported(),
  stripAudio: (...a: unknown[]) => stripAudio(...(a as [])),
}));

import DashboardMedia from "@/components/dashboard/DashboardMedia";
import { I18nProvider } from "@/i18n/context";

const realVideo = (name = "clip.mp4") => new File([new Uint8Array([1, 2, 3])], name, { type: "video/mp4" });
const realPhoto = () => new File([new Uint8Array([1])], "shot.png", { type: "image/png" });

async function openLibrary(locale = "en") {
  window.history.replaceState({}, "", `/${locale}`);
  const user = userEvent.setup();
  const { container } = render(<I18nProvider><DashboardMedia /></I18nProvider>);
  await screen.findByLabelText(/./i).catch(() => undefined);
  await waitFor(() => expect(container.querySelector('input[type="file"]')).toBeTruthy());
  return { user, input: container.querySelector('input[type="file"]') as HTMLInputElement };
}

const toggle = () => screen.getByRole("switch");

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(toasts)) toasts[k].length = 0;
  isConverterSupported.mockReturnValue(true);
  stripAudio.mockResolvedValue({ blob: new Blob(["muted"], { type: "video/mp4" }), size: 5, hadAudio: true });
});
afterEach(cleanup);

describe("remove-audio option", () => {
  it("is off by default and shows the localized label in ES/EN/RU", async () => {
    await openLibrary("es");
    expect(toggle()).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText(COPY.removeAudio.es)).toBeInTheDocument();
    cleanup();
    await openLibrary("ru");
    expect(screen.getByText(COPY.removeAudio.ru)).toBeInTheDocument();
    cleanup();
    await openLibrary("en");
    expect(screen.getByText(COPY.removeAudio.en)).toBeInTheDocument();
  });

  it("uploads the original file and never loads the mute helper while off", async () => {
    const { user, input } = await openLibrary();
    await user.upload(input, realVideo());
    await waitFor(() => expect(uploadResumable).toHaveBeenCalled());
    expect(stripAudio).not.toHaveBeenCalled();
    expect(uploadResumable.mock.calls[0][1]).toBeInstanceOf(File);
  });

  it("uploads only the muted output when on", async () => {
    const { user, input } = await openLibrary();
    await user.click(toggle());
    await user.upload(input, realVideo());
    await waitFor(() => expect(uploadResumable).toHaveBeenCalled());
    expect(stripAudio).toHaveBeenCalledTimes(1);
    const sent = uploadResumable.mock.calls[0][1] as Blob;
    expect(sent).not.toBeInstanceOf(File);
    expect(await sent.text()).toBe("muted");
    // Container/MIME preserved and the fresh upload is not claimed to be optimized.
    expect(uploadResumable.mock.calls[0][2]).toBe("video/mp4");
    expect(String(uploadResumable.mock.calls[0][0])).toMatch(/\.mp4$/);
  });

  it("reports honestly when the source had no audio", async () => {
    stripAudio.mockResolvedValueOnce({ blob: new Blob(["same"], { type: "video/mp4" }), size: 4, hadAudio: false });
    const { user, input } = await openLibrary();
    await user.click(toggle());
    await user.upload(input, realVideo());
    await waitFor(() => expect(uploadResumable).toHaveBeenCalled());
    expect(toasts.info.flat().join(" ")).toContain("had no audio track");
  });

  it("skips the file instead of uploading the original when muting fails", async () => {
    stripAudio.mockRejectedValueOnce(new Error("remux failed"));
    const { user, input } = await openLibrary();
    await user.click(toggle());
    await user.upload(input, realVideo());
    await waitFor(() => expect(toasts.error.length).toBeGreaterThan(0));
    expect(uploadResumable).not.toHaveBeenCalled();
    expect(toasts.error.flat().join(" ")).toContain("Could not remove the audio");
  });

  it("skips the file on cancellation", async () => {
    stripAudio.mockRejectedValueOnce(new DOMException("Cancelled", "AbortError"));
    const { user, input } = await openLibrary();
    await user.click(toggle());
    await user.upload(input, realVideo());
    await waitFor(() => expect(toasts.info.length).toBeGreaterThan(0));
    expect(uploadResumable).not.toHaveBeenCalled();
    expect(toasts.info.flat().join(" ")).toContain("cancelled");
  });

  it("skips the file when the browser cannot run the helper", async () => {
    isConverterSupported.mockReturnValue(false);
    const { user, input } = await openLibrary();
    await user.click(toggle());
    await user.upload(input, realVideo());
    await waitFor(() => expect(toasts.error.length).toBeGreaterThan(0));
    expect(uploadResumable).not.toHaveBeenCalled();
    expect(stripAudio).not.toHaveBeenCalled();
  });

  it("leaves image uploads untouched even when on", async () => {
    const { user, input } = await openLibrary();
    await user.click(toggle());
    await user.upload(input, realPhoto());
    await waitFor(() => expect(imageUpload).toHaveBeenCalled());
    expect(stripAudio).not.toHaveBeenCalled();
    expect(optimizeImage).toHaveBeenCalledTimes(1);
  });

  it("continues the rest of a multi-file selection after one failure", async () => {
    stripAudio
      .mockRejectedValueOnce(new Error("remux failed"))
      .mockResolvedValueOnce({ blob: new Blob(["muted2"], { type: "video/mp4" }), size: 6, hadAudio: true });
    const { user, input } = await openLibrary();
    await user.click(toggle());
    await user.upload(input, [realVideo("a.mp4"), realVideo("b.mp4"), realPhoto()]);
    await waitFor(() => expect(imageUpload).toHaveBeenCalled());
    expect(stripAudio).toHaveBeenCalledTimes(2);
    expect(uploadResumable).toHaveBeenCalledTimes(1);
    expect(await (uploadResumable.mock.calls[0][1] as Blob).text()).toBe("muted2");
  });
});
