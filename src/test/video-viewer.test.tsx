/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import VideoViewer from "@/components/media/VideoViewer";

const capture = vi.fn();
vi.mock("@/lib/video-frame", async () => {
  const actual = await vi.importActual<typeof import("@/lib/video-frame")>("@/lib/video-frame");
  return { ...actual, captureVideoFrame: (...a: unknown[]) => capture(...a) };
});

/** jsdom has no media pipeline: fake the intrinsic size / duration the viewer reads. */
const loadMetadata = (video: HTMLVideoElement, width: number, height: number, duration = 20) => {
  Object.defineProperty(video, "videoWidth", { value: width, configurable: true });
  Object.defineProperty(video, "videoHeight", { value: height, configurable: true });
  Object.defineProperty(video, "duration", { value: duration, configurable: true });
  fireEvent.loadedMetadata(video);
};

beforeEach(() => {
  capture.mockReset();
  capture.mockResolvedValue({
    blob: new Blob(["x"], { type: "image/webp" }),
    width: 640,
    height: 360,
    ext: "webp",
    mimeType: "image/webp",
  });
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
  URL.createObjectURL = vi.fn(() => "blob:frame");
  URL.revokeObjectURL = vi.fn();
  window.innerWidth = 1280;
  window.innerHeight = 900;
});
afterEach(cleanup);

describe("VideoViewer sizing", () => {
  it("does not upscale a clip smaller than the viewport", () => {
    render(<VideoViewer src="/clip.mp4" lang="en" />);
    const video = screen.getByTestId("viewer-video") as HTMLVideoElement;
    loadMetadata(video, 320, 568);
    expect(video.style.width).toBe("320px");
    expect(video.style.height).toBe("568px");
    expect(video.className).not.toContain("w-screen");
    expect(video.className).toContain("object-contain");
  });

  it("shrinks a clip larger than the available box on both axes", () => {
    render(<VideoViewer src="/clip.mp4" lang="en" chromeY={300} />);
    const video = screen.getByTestId("viewer-video") as HTMLVideoElement;
    loadMetadata(video, 3840, 2160);
    expect(parseInt(video.style.width, 10)).toBeLessThanOrEqual(1280);
    expect(parseInt(video.style.height, 10)).toBeLessThanOrEqual(600);
  });

  it("plays inline and hides the native controls in favour of the custom strip", () => {
    render(<VideoViewer src="/clip.mp4" lang="en" />);
    const video = screen.getByTestId("viewer-video") as HTMLVideoElement;
    expect(video.hasAttribute("controls")).toBe(false);
    expect(video.hasAttribute("playsinline")).toBe(true);
    expect(screen.getByTestId("viewer-playpause")).toBeTruthy();
  });
});

describe("VideoViewer controls", () => {
  it("toggles playback and swaps the localized label", () => {
    render(<VideoViewer src="/clip.mp4" lang="es" />);
    const button = screen.getByTestId("viewer-playpause");
    expect(button.getAttribute("aria-label")).toBe("Reproducir");
    fireEvent.click(button);
    fireEvent.play(screen.getByTestId("viewer-video"));
    expect(button.getAttribute("aria-label")).toBe("Pausar");
  });

  it("seeks with the slider and updates the time readout", () => {
    render(<VideoViewer src="/clip.mp4" lang="en" />);
    const video = screen.getByTestId("viewer-video") as HTMLVideoElement;
    loadMetadata(video, 640, 360, 40);
    const slider = screen.getByTestId("viewer-seek") as HTMLInputElement;
    expect(slider.max).toBe("40");
    fireEvent.change(slider, { target: { value: "15" } });
    expect(video.currentTime).toBe(15);
    expect(screen.getByTestId("viewer-time").textContent).toContain("0:15");
  });

  it("supports Space and arrow keys inside the viewer", () => {
    render(<VideoViewer src="/clip.mp4" lang="ru" />);
    const viewer = screen.getByTestId("video-viewer");
    const video = screen.getByTestId("viewer-video") as HTMLVideoElement;
    loadMetadata(video, 640, 360, 40);
    fireEvent.keyDown(viewer, { key: " " });
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();
    fireEvent.keyDown(viewer, { key: "ArrowRight" });
    expect(video.currentTime).toBeGreaterThan(0);
    const after = video.currentTime;
    fireEvent.keyDown(viewer, { key: "ArrowLeft" });
    expect(video.currentTime).toBeLessThan(after);
  });

  it("localizes the seek label in Russian", () => {
    render(<VideoViewer src="/clip.mp4" lang="ru" />);
    expect(screen.getByTestId("viewer-seek").getAttribute("aria-label")).toBe("Перемотка видео");
  });
});

describe("VideoViewer frame picker", () => {
  it("is hidden when no save handler is provided", () => {
    render(<VideoViewer src="/clip.mp4" lang="en" />);
    expect(screen.queryByTestId("viewer-capture")).toBeNull();
  });

  it("captures the current frame and writes nothing until Save", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<VideoViewer src="/clip.mp4" lang="en" onSavePoster={onSave} />);
    const video = screen.getByTestId("viewer-video") as HTMLVideoElement;
    loadMetadata(video, 640, 360, 40);
    fireEvent.change(screen.getByTestId("viewer-seek"), { target: { value: "12" } });

    fireEvent.click(screen.getByTestId("viewer-capture"));
    await waitFor(() => expect(screen.getByTestId("viewer-frame-preview")).toBeTruthy());
    expect(capture).toHaveBeenCalledWith(video);
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("viewer-frame-save"));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].ext).toBe("webp");
  });

  it("discards the frame on Cancel without saving", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<VideoViewer src="/clip.mp4" lang="en" onSavePoster={onSave} />);
    loadMetadata(screen.getByTestId("viewer-video") as HTMLVideoElement, 640, 360);
    fireEvent.click(screen.getByTestId("viewer-capture"));
    await waitFor(() => expect(screen.getByTestId("viewer-frame-preview")).toBeTruthy());
    fireEvent.click(screen.getByTestId("viewer-frame-cancel"));
    await waitFor(() => expect(screen.queryByTestId("viewer-frame-preview")).toBeNull());
    expect(onSave).not.toHaveBeenCalled();
  });

  it("shows a localized message when the browser blocks the capture", async () => {
    const { FrameCaptureError } = await import("@/lib/video-frame");
    capture.mockRejectedValue(new FrameCaptureError("cors", "tainted"));
    render(<VideoViewer src="/clip.mp4" lang="es" onSavePoster={vi.fn()} />);
    loadMetadata(screen.getByTestId("viewer-video") as HTMLVideoElement, 640, 360);
    fireEvent.click(screen.getByTestId("viewer-capture"));
    await waitFor(() =>
      expect(screen.getByTestId("viewer-frame-error").textContent).toContain("por motivos de seguridad"),
    );
  });
});
