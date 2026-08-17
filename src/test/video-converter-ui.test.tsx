/**
 * VideoConverterDialog behaviour that only shows up through the real component:
 *  - an encoded result belongs to the settings it was produced with, and is discarded the
 *    moment any of those settings change (otherwise MP4 bytes could be sent as WebM);
 *  - closing the dialog mid-initialization stops the source/core downloads before the
 *    engine is ever probed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VideoConverterDialog from "@/components/dashboard/VideoConverterDialog";

const CAPS = { h264: true, vp9: true, aac: true, opus: true, mp3lame: true, vorbis: true };

const probeEncoders = vi.fn();
const probeVideoMeta = vi.fn(async () => ({ width: 1920, height: 1080, duration: 12, size: 1000 }));
const convertVideo = vi.fn(async () => ({ blob: new Blob(["x"]), size: 400 }));

vi.mock("@/lib/video-ffmpeg", () => ({
  isConverterSupported: () => true,
  probeEncoders: (signal?: AbortSignal) => probeEncoders(signal),
  probeVideoMeta: (f: File) => probeVideoMeta(f),
  convertVideo: (...a: unknown[]) => convertVideo(...(a as [])),
}));

const commitVideoReplacement = vi.fn(async () => ({ updatedReferences: 0 }));
vi.mock("@/lib/media-usage", () => ({
  commitVideoReplacement: (...a: unknown[]) => commitVideoReplacement(...(a as [])),
}));

vi.mock("@/lib/video-upload", () => ({
  removeObject: vi.fn(async () => true),
  stagedObjectName: vi.fn(async (ext: string) => `staged-u-1.${ext}`),
  uploadResumable: vi.fn(async () => undefined),
}));

const L = ((k: string) => k) as never;
const FILE = { name: "clip.mp4", url: "https://example.test/clip.mp4", size: 1000 };

/** Source fetch that only resolves when the test lets it. */
let releaseFetch: (() => void) | null = null;
let fetchSignal: AbortSignal | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  probeEncoders.mockResolvedValue(CAPS);
  releaseFetch = null;
  fetchSignal = undefined;
  global.URL.createObjectURL = vi.fn(() => "blob:result");
  global.URL.revokeObjectURL = vi.fn();
  vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => {
    fetchSignal = init?.signal ?? undefined;
    return new Promise((resolve, reject) => {
      const finish = () => resolve({ ok: true, status: 200, blob: async () => new Blob(["src"], { type: "video/mp4" }) } as Response);
      if (!releaseFetch) return finish();
      releaseFetch = finish;
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    });
  }));
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function openAndConvert() {
  const user = userEvent.setup();
  render(<VideoConverterDialog file={FILE} L={L} onClose={vi.fn()} onReplaced={vi.fn()} />);
  await screen.findByText("startConvert");
  await user.click(screen.getByText("startConvert"));
  await screen.findByText("replaceOriginal");
  return user;
}

/** Picks an option out of a shadcn Select by its visible label. */
async function choose(user: ReturnType<typeof userEvent.setup>, triggerId: string, option: string) {
  await user.click(document.getElementById(triggerId)!);
  await user.click(await screen.findByRole("option", { name: option }));
}

describe("conversion result never goes stale", () => {
  it("offers Replace right after a successful conversion", async () => {
    await openAndConvert();
    expect(screen.getByText("replaceOriginal")).toBeInTheDocument();
  });

  it("withdraws Replace when the format changes after converting", async () => {
    const user = await openAndConvert();
    await choose(user, "vc-format", "WEBM");
    // The bytes on hand are MP4; sending them as video/webm is exactly the mismatch
    // this guard exists to prevent.
    await waitFor(() => expect(screen.queryByText("replaceOriginal")).not.toBeInTheDocument());
  });

  it("withdraws Replace when the resolution changes after converting", async () => {
    const user = await openAndConvert();
    await choose(user, "vc-res", "480p");
    await waitFor(() => expect(screen.queryByText("replaceOriginal")).not.toBeInTheDocument());
  });

  it("withdraws Replace when the quality changes after converting", async () => {
    const user = await openAndConvert();
    await choose(user, "vc-quality", "qSmall");
    await waitFor(() => expect(screen.queryByText("replaceOriginal")).not.toBeInTheDocument());
  });

  it("brings Replace back once the new settings are actually converted", async () => {
    const user = await openAndConvert();
    await choose(user, "vc-format", "WEBM");
    await waitFor(() => expect(screen.queryByText("replaceOriginal")).not.toBeInTheDocument());
    await user.click(screen.getByText("startConvert"));
    expect(await screen.findByText("replaceOriginal")).toBeInTheDocument();
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();
  });
});

describe("honest optimization verdict", () => {
  const run = async (newSize: number) => {
    const onVerdict = vi.fn();
    convertVideo.mockResolvedValueOnce({ blob: new Blob(["x"]), size: newSize });
    const user = userEvent.setup();
    render(<VideoConverterDialog file={FILE} L={L} onClose={vi.fn()} onReplaced={vi.fn()} onVerdict={onVerdict} />);
    await screen.findByText("startConvert");
    await user.click(screen.getByText("startConvert"));
    await waitFor(() => expect(convertVideo).toHaveBeenCalled());
    return onVerdict;
  };

  it("reports canOptimize for a real saving", async () => {
    const onVerdict = await run(400);
    await waitFor(() => expect(onVerdict).toHaveBeenCalledWith("clip.mp4", "canOptimize"));
  });

  it("reports optimized only when the saving is below the threshold", async () => {
    const onVerdict = await run(990);
    await waitFor(() => expect(onVerdict).toHaveBeenCalledWith("clip.mp4", "optimized"));
  });

  it("reports nothing when the result is simply bigger", async () => {
    // A larger output proves the chosen settings were poor, not that the source is optimal.
    const onVerdict = await run(4000);
    await screen.findByText("startConvert");
    await waitFor(() => expect(screen.getByText("biggerResult")).toBeInTheDocument());
    expect(onVerdict).not.toHaveBeenCalled();
  });
});

describe("initialization is abortable", () => {
  it("aborts the source download and never probes the engine when closed early", async () => {
    releaseFetch = () => undefined; // hold the fetch open
    const { unmount } = render(
      <VideoConverterDialog file={FILE} L={L} onClose={vi.fn()} onReplaced={vi.fn()} />,
    );
    await screen.findByText("loadingEngine");
    unmount();
    await waitFor(() => expect(fetchSignal?.aborted).toBe(true));
    expect(probeVideoMeta).not.toHaveBeenCalled();
    expect(probeEncoders).not.toHaveBeenCalled();
  });

  it("passes an abort signal down to the encoder probe", async () => {
    render(<VideoConverterDialog file={FILE} L={L} onClose={vi.fn()} onReplaced={vi.fn()} />);
    await screen.findByText("startConvert");
    expect(probeEncoders).toHaveBeenCalledWith(expect.any(AbortSignal));
  });
});
