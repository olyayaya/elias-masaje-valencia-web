import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { parseView, loadView, saveView, DEFAULT_VIEW, VIEW_STORAGE_KEY } from "@/lib/media-view-storage";
import { splitFileName, sanitizeBaseInput, buildRenameName } from "@/lib/rename-name";

const renameMediaFile = vi.fn();
const checkMediaUsage = vi.fn().mockResolvedValue({ usages: [], historyReferences: 0 });

vi.mock("@/lib/media-usage", () => ({
  checkMediaUsage: (...a: unknown[]) => checkMediaUsage(...a),
  checkMediaUsageBatch: vi.fn().mockResolvedValue({ usage: {} }),
  deleteMediaFile: vi.fn(),
  renameMediaFile: (...a: unknown[]) => renameMediaFile(...a),
  replaceMediaFile: vi.fn(),
  commitVideoReplacement: vi.fn(),
  MediaGuardError: class extends Error {},
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock("@/components/dashboard/MediaProcessingDialog", () => ({
  default: () => <div role="dialog">processing</div>,
}));

const OBJECTS = [
  { name: "hero.webp", metadata: { size: 500 * 1024, mimetype: "image/webp" }, created_at: "2026-01-02T00:00:00Z" },
  { name: "reel.mp4", metadata: { size: 12 * 1024 * 1024, mimetype: "video/mp4" }, created_at: "2026-02-02T00:00:00Z" },
  { name: "notes.pdf", metadata: { size: 90 * 1024, mimetype: "application/pdf" }, created_at: "2026-03-02T00:00:00Z" },
];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({
        list: async () => ({ data: OBJECTS, error: null }),
        download: async () => ({ data: new Blob(["x"], { type: "video/mp4" }), error: null }),
        getPublicUrl: (n: string) => ({ data: { publicUrl: `https://cdn.test/${n}` } }),
        remove: vi.fn(),
      }),
    },
  },
}));

import DashboardMedia from "@/components/dashboard/DashboardMedia";
import { I18nProvider } from "@/i18n/context";

const renderLibrary = async () => {
  window.history.replaceState({}, "", "/en");
  const user = userEvent.setup();
  render(
    <I18nProvider>
      <DashboardMedia />
    </I18nProvider>,
  );
  await screen.findByText("hero.webp");
  return user;
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("video thumbnails", () => {
  it("renders a real video frame element for videos, not a generic icon", async () => {
    await renderLibrary();
    const thumbs = screen.getAllByTestId("video-thumb") as HTMLVideoElement[];
    expect(thumbs).toHaveLength(1);
    // Media fragment so the painted frame is not the (often black) first frame.
    expect(thumbs[0].getAttribute("src")).toBe("https://cdn.test/reel.mp4#t=0.3");
    expect(thumbs[0].getAttribute("preload")).toBe("metadata");
  });

  it("falls back to an icon when the video frame cannot be decoded", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await renderLibrary();
    const video = screen.getAllByTestId("video-thumb")[0];
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.error(video);
    await waitFor(() => expect(screen.queryAllByTestId("video-thumb")).toHaveLength(0));
    // A fallback tile exists for the video AND for the unknown pdf — never empty space.
    expect(screen.getAllByTestId("thumb-fallback").length).toBeGreaterThanOrEqual(2);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("view switcher", () => {
  it("switches to tiles, changes size and restores the preference", async () => {
    const user = await renderLibrary();
    await user.click(screen.getByRole("tab", { name: "Tiles" }));
    const grid = await screen.findByTestId("media-grid");
    expect(grid.getAttribute("data-size")).toBe("m");
    // Same filtered set as the list.
    expect(screen.getByText("hero.webp")).toBeInTheDocument();
    expect(screen.getByText("reel.mp4")).toBeInTheDocument();
    expect(screen.getByText("notes.pdf")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Large" }));
    await waitFor(() => expect(screen.getByTestId("media-grid").getAttribute("data-size")).toBe("l"));
    expect(loadView()).toEqual({ view: "grid", size: "l" });
  });

  it("grid action bar reuses the same handlers as the list", async () => {
    const user = await renderLibrary();
    await user.click(screen.getByRole("tab", { name: "Tiles" }));
    await screen.findByTestId("media-grid");
    // Delete on a grid card goes through the same usage check + confirmation dialog.
    await user.click(screen.getByRole("button", { name: "Delete reel.mp4" }));
    await waitFor(() => expect(checkMediaUsage).toHaveBeenCalledWith("reel.mp4"));
    expect(await screen.findByText(/Delete reel.mp4\?/)).toBeInTheDocument();
  });

  it("restores a persisted grid preference on mount", async () => {
    saveView({ view: "grid", size: "s" });
    await renderLibrary();
    expect(screen.getByTestId("media-grid").getAttribute("data-size")).toBe("s");
  });
});

describe("rename keeps the extension read-only", () => {
  it("shows only the basename in the input and the extension as a locked suffix", async () => {
    const user = await renderLibrary();
    await user.click(screen.getByRole("button", { name: "Rename reel.mp4" }));
    const input = (await screen.findByLabelText("New name")) as HTMLInputElement;
    expect(input.value).toBe("reel");
    expect(screen.getByTestId("rename-ext").textContent).toBe(".mp4");
    expect(screen.getByTestId("rename-ext").tagName).toBe("SPAN");
  });

  it("pasting the full name does not produce a double extension", async () => {
    renameMediaFile.mockResolvedValue({ renamed: true, updatedReferences: 0 });
    const user = await renderLibrary();
    await user.click(screen.getByRole("button", { name: "Rename reel.mp4" }));
    const input = await screen.findByLabelText("New name");
    await user.clear(input);
    await user.paste("master-reel.mp4");
    expect((input as HTMLInputElement).value).toBe("master-reel");
    await user.click(screen.getByRole("button", { name: "Rename" }));
    await waitFor(() => expect(renameMediaFile).toHaveBeenCalledWith("reel.mp4", "master-reel.mp4"));
  });

  it("blocks an empty basename and a smuggled second extension", async () => {
    const user = await renderLibrary();
    await user.click(screen.getByRole("button", { name: "Rename reel.mp4" }));
    const input = await screen.findByLabelText("New name");
    await user.clear(input);
    await user.click(screen.getByRole("button", { name: "Rename" }));
    expect(await screen.findByText("Name cannot be empty")).toBeInTheDocument();

    await user.type(input, "clip.webm");
    await user.click(screen.getByRole("button", { name: "Rename" }));
    expect(await screen.findByText(/Keep the .mp4 extension/)).toBeInTheDocument();
    expect(renameMediaFile).not.toHaveBeenCalled();
  });
});

describe("name/view helpers", () => {
  it("splits, sanitizes and rebuilds names", () => {
    expect(splitFileName("a.b.mp4")).toEqual({ base: "a.b", ext: ".mp4" });
    expect(splitFileName("README")).toEqual({ base: "README", ext: "" });
    expect(sanitizeBaseInput("../x/y.mp4", ".mp4")).toBe("xy");
    expect(sanitizeBaseInput("clip.MP4", ".mp4")).toBe("clip");
    expect(buildRenameName(" clip ", ".mp4")).toBe("clip.mp4");
  });

  it("degrades corrupted view storage to the default", () => {
    expect(parseView(null)).toEqual(DEFAULT_VIEW);
    expect(parseView("{oops")).toEqual(DEFAULT_VIEW);
    expect(parseView(JSON.stringify({ v: 9, view: "grid" }))).toEqual(DEFAULT_VIEW);
    expect(parseView(JSON.stringify({ v: 1, view: "nope", size: "xl" }))).toEqual(DEFAULT_VIEW);
    saveView({ view: "grid", size: "s" });
    expect(localStorage.getItem(VIEW_STORAGE_KEY)).toContain('"grid"');
  });
});
