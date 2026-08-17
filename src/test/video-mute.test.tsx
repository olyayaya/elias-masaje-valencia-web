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
      "-movflags", "+faststart", "-f", "mp4", "-y", "mute-out.mp4",
    ]);
    // No quality knobs at all: no CRF, no scaling, no video encoder.
    expect(args).not.toContain("-crf");
    expect(args).not.toContain("libx264");
    expect(args).not.toContain("-vf");
  });

  it("forces the ISO BMFF muxer for .m4v instead of raw MPEG-4 video", () => {
    const args = buildStripAudioArgs({ inputName: "a-in.m4v", outputName: "a-out.m4v" });
    expect(args[args.indexOf("-f") + 1]).toBe("mp4");
    expect(args).toContain("-movflags");
    expect(args.at(-1)).toBe("a-out.m4v");
  });

  it("uses the mov muxer for QuickTime sources", () => {
    const args = buildStripAudioArgs({ inputName: "a-in.mov", outputName: "a-out.mov" });
    expect(args[args.indexOf("-f") + 1]).toBe("mov");
  });

  it("keeps the source container and omits mov-only flags for WebM", () => {
    const args = buildStripAudioArgs({ inputName: "mute-in.webm", outputName: "mute-out.webm" });
    expect(args).not.toContain("-movflags");
    expect(args[args.indexOf("-f") + 1]).toBe("webm");
    expect(args.at(-1)).toBe("mute-out.webm");
  });


  it("detects whether the source had an audio stream", () => {
    expect(logHasAudioStream("Stream #0:1(eng): Audio: aac (LC), 48000 Hz")).toBe(true);
    expect(logHasAudioStream("Stream #0:0: Video: h264 (High)")).toBe(false);
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

const uploadResumable = vi.fn(async (..._a: unknown[]) => undefined);
vi.mock("@/lib/video-upload", () => ({
  uploadResumable: (...a: unknown[]) => uploadResumable(...(a as [])),
  removeObject: vi.fn(async () => true),
  stagedObjectName: vi.fn(async () => "staged-x.mp4"),
}));

const imageUpload = vi.fn(async (..._a: unknown[]) => ({ error: null }));
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
    expect(sent.size).toBe(5); // the muted remux, not the 3-byte original
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
    expect((uploadResumable.mock.calls[0][1] as Blob).size).toBe(6); // second file's muted output
  });
});
