import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const checkMediaUsageBatch = vi.fn();
const commitVideoReplacement = vi.fn();
const toastError = vi.fn();

vi.mock("@/lib/media-usage", () => ({
  checkMediaUsage: vi.fn(),
  checkMediaUsageBatch: (...a: unknown[]) => checkMediaUsageBatch(...a),
  deleteMediaFile: vi.fn(),
  renameMediaFile: vi.fn(),
  replaceMediaFile: vi.fn(),
  commitVideoReplacement: (...a: unknown[]) => commitVideoReplacement(...a),
  MediaGuardError: class extends Error {},
}));

vi.mock("sonner", () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

/**
 * The converter module is the only place that imports ffmpeg. Mocking it here proves the
 * Library renders (and lists videos) without ever touching the wasm engine.
 */
const converterLoaded = vi.fn();
vi.mock("@/components/dashboard/VideoConverterDialog", () => ({
  default: (props: { file: { name: string }; onClose: () => void }) => {
    converterLoaded(props.file.name);
    return <div role="dialog">converter:{props.file.name}</div>;
  },
}));

const OBJECTS = [
  { name: "hero.webp", metadata: { size: 500 * 1024, mimetype: "image/webp" }, created_at: "2026-01-02T00:00:00Z" },
  { name: "promo.mp4", metadata: { size: 40 * 1024 * 1024, mimetype: "video/mp4" }, created_at: "2026-02-02T00:00:00Z" },
  { name: "notes.pdf", metadata: { size: 90 * 1024, mimetype: "application/pdf" }, created_at: "2026-03-02T00:00:00Z" },
];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({
        list: async () => ({ data: OBJECTS, error: null }),
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

beforeEach(() => vi.clearAllMocks());

describe("Library categories", () => {
  it("renames the section to Library and counts photos, videos and other files", async () => {
    await renderLibrary();
    const photos = screen.getByRole("tab", { name: /Photos/ });
    const videos = screen.getByRole("tab", { name: /Videos/ });
    expect(within(photos).getByText("1")).toBeInTheDocument();
    expect(within(videos).getByText("1")).toBeInTheDocument();
    expect(within(screen.getByRole("tab", { name: /Other/ })).getByText("1")).toBeInTheDocument();
  });

  it("filters the list down to videos only", async () => {
    const user = await renderLibrary();
    await user.click(screen.getByRole("tab", { name: /Videos/ }));
    await waitFor(() => expect(screen.queryByText("hero.webp")).not.toBeInTheDocument());
    expect(screen.getByText("promo.mp4")).toBeInTheDocument();
    expect(screen.queryByText("notes.pdf")).not.toBeInTheDocument();
  });

  it("offers compression for photos and conversion for videos, never the other way round", async () => {
    await renderLibrary();
    expect(screen.getByLabelText("Smart compress hero.webp")).toBeInTheDocument();
    expect(screen.queryByLabelText("Smart compress promo.mp4")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Convert video promo.mp4")).toBeInTheDocument();
    expect(screen.queryByLabelText("Convert video hero.webp")).not.toBeInTheDocument();
    // Unknown files get neither optimizer.
    expect(screen.queryByLabelText("Smart compress notes.pdf")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Convert video notes.pdf")).not.toBeInTheDocument();
  });

  it("loads the converter only when a video conversion is requested", async () => {
    const user = await renderLibrary();
    expect(converterLoaded).not.toHaveBeenCalled();
    await user.click(screen.getByLabelText("Convert video promo.mp4"));
    await waitFor(() => expect(converterLoaded).toHaveBeenCalledWith("promo.mp4"));
  });

  it("searches by name", async () => {
    const user = await renderLibrary();
    await user.type(screen.getByLabelText("Search by name"), "promo");
    await waitFor(() => expect(screen.queryByText("hero.webp")).not.toBeInTheDocument());
    expect(screen.getByText("promo.mp4")).toBeInTheDocument();
  });

  it("resolves usage for every file in a single batch request", async () => {
    checkMediaUsageBatch.mockResolvedValue({ usage: { "hero.webp": 3, "promo.mp4": 0, "notes.pdf": 0 } });
    const user = await renderLibrary();
    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.click(screen.getByRole("button", { name: "Check usage" }));
    await waitFor(() => expect(checkMediaUsageBatch).toHaveBeenCalledTimes(1));
    expect(checkMediaUsageBatch).toHaveBeenCalledWith(["hero.webp", "promo.mp4", "notes.pdf"]);
    await screen.findByText(/In use/);
  });

  it("reports a failed usage scan instead of pretending files are unused", async () => {
    checkMediaUsageBatch.mockRejectedValue(new Error("scan exploded"));
    const user = await renderLibrary();
    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.click(screen.getByRole("button", { name: "Check usage" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("scan exploded"));
    expect(screen.queryByText(/Unused/)).not.toBeInTheDocument();
  });
});
