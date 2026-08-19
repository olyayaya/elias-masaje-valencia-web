/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

const upload = vi.fn();
const remove = vi.fn();
const renameMediaFile = vi.fn();
const deleteMediaFile = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: (...a: unknown[]) => upload(...a),
        remove: (...a: unknown[]) => remove(...a),
        getPublicUrl: (name: string) => ({ data: { publicUrl: `https://cdn.test/media/${name}` } }),
      }),
    },
  },
}));
vi.mock("@/lib/media-usage", () => ({
  renameMediaFile: (...a: unknown[]) => renameMediaFile(...a),
  deleteMediaFile: (...a: unknown[]) => deleteMediaFile(...a),
}));

import {
  deleteLibraryPoster,
  findPosterName,
  posterMap,
  posterNameFor,
  renameLibraryPoster,
  saveLibraryPoster,
} from "@/lib/library-poster";
import MediaThumb from "@/components/dashboard/media/MediaThumb";
import type { LibraryFile } from "@/lib/media-filters";

const file = (name: string): LibraryFile => ({
  name,
  size: 1000,
  url: `https://cdn.test/media/${name}`,
  created_at: "2026-01-01T00:00:00Z",
});

beforeEach(() => {
  upload.mockReset().mockResolvedValue({ error: null });
  remove.mockReset().mockResolvedValue({ error: null });
  renameMediaFile.mockReset().mockResolvedValue({ renamed: true });
  deleteMediaFile.mockReset().mockResolvedValue({ deleted: true });
});
afterEach(cleanup);

describe("library poster sidecar", () => {
  it("derives a deterministic name from the video", () => {
    expect(posterNameFor("clip.mp4")).toBe("clip-cover.webp");
    expect(posterNameFor("clip.mp4", "jpg")).toBe("clip-cover.jpg");
  });

  it("resolves the existing sidecar, preferring WebP", () => {
    expect(findPosterName("clip.mp4", ["clip-cover.jpg", "clip-cover.webp"])).toBe("clip-cover.webp");
    expect(findPosterName("clip.mp4", ["other.webp"])).toBeNull();
    expect(posterMap([file("clip.mp4"), file("clip-cover.webp")])).toEqual({ "clip.mp4": "clip-cover.webp" });
  });

  it("upserts one object and drops the stale encoding", async () => {
    const url = await saveLibraryPoster("clip.mp4", new Blob(["x"]), "webp", "image/webp");
    expect(upload).toHaveBeenCalledWith("clip-cover.webp", expect.anything(), expect.objectContaining({ upsert: true }));
    expect(remove).toHaveBeenCalledWith(["clip-cover.jpg"]);
    expect(url).toBe("https://cdn.test/media/clip-cover.webp");
  });

  it("renames the sidecar with its video so no orphan is left", async () => {
    const next = await renameLibraryPoster("clip.mp4", "session.mp4", ["clip.mp4", "clip-cover.webp"]);
    expect(renameMediaFile).toHaveBeenCalledWith("clip-cover.webp", "session-cover.webp");
    expect(next).toBe("session-cover.webp");
  });

  it("does nothing when the video has no sidecar", async () => {
    expect(await renameLibraryPoster("clip.mp4", "session.mp4", ["clip.mp4"])).toBeNull();
    expect(await deleteLibraryPoster("clip.mp4", ["clip.mp4"])).toBeNull();
    expect(renameMediaFile).not.toHaveBeenCalled();
    expect(deleteMediaFile).not.toHaveBeenCalled();
  });

  it("deletes the sidecar through media-guard", async () => {
    expect(await deleteLibraryPoster("clip.mp4", ["clip.mp4", "clip-cover.jpg"])).toBe("clip-cover.jpg");
    expect(deleteMediaFile).toHaveBeenCalledWith("clip-cover.jpg");
  });
});

describe("library thumbnail preference", () => {
  it("prefers the saved poster over the live frame", () => {
    render(<MediaThumb file={file("clip.mp4")} posterUrl="https://cdn.test/media/clip-cover.webp" />);
    expect(screen.getByTestId("video-poster-thumb").getAttribute("src")).toContain("clip-cover.webp");
  });

  it("falls back to a video frame when there is no poster", () => {
    const { container } = render(<MediaThumb file={file("clip.mp4")} />);
    const video = container.querySelector("video");
    expect(video?.getAttribute("src")).toContain("#t=0.3");
  });

  it("falls back to the frame when the poster fails to load", () => {
    const { container } = render(<MediaThumb file={file("clip.mp4")} posterUrl="https://cdn.test/broken.webp" />);
    fireEvent.error(screen.getByTestId("video-poster-thumb"));
    expect(container.querySelector("video")?.getAttribute("src")).toContain("#t=0.3");
  });
});
