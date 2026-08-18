import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const checkMediaUsageBatch = vi.fn();

vi.mock("@/lib/media-usage", () => ({
  checkMediaUsage: vi.fn(),
  checkMediaUsageBatch: (...a: unknown[]) => checkMediaUsageBatch(...a),
  deleteMediaFile: vi.fn(),
  renameMediaFile: vi.fn(),
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

const OBJECTS = Array.from({ length: 30 }, (_, i) => ({
  name: `photo-${String(i).padStart(2, "0")}.webp`,
  metadata: { size: (i + 1) * 1024, mimetype: "image/webp" },
  created_at: `2026-01-${String((i % 28) + 1).padStart(2, "0")}T00:00:00Z`,
})).concat([
  { name: "clip.mp4", metadata: { size: 5 * 1024 * 1024, mimetype: "video/mp4" }, created_at: "2026-02-01T00:00:00Z" },
]);

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({
        list: async () => ({ data: OBJECTS, error: null }),
        download: async () => ({ data: new Blob(["x"]), error: null }),
        getPublicUrl: (n: string) => ({ data: { publicUrl: `https://cdn.test/${n}` } }),
        remove: vi.fn(),
      }),
    },
  },
}));

import DashboardMedia from "@/components/dashboard/DashboardMedia";
import { I18nProvider } from "@/i18n/context";
import { FILTERS_STORAGE_KEY } from "@/lib/media-filters-storage";
import { DEFAULT_FILTERS } from "@/lib/media-filters";

const mount = async (expectText = "photo-00.webp") => {
  window.history.replaceState({}, "", "/en");
  const user = userEvent.setup();
  const view = render(
    <I18nProvider>
      <DashboardMedia />
    </I18nProvider>,
  );
  await screen.findByText(expectText);
  return { user, view };
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("library renders the whole filtered list", () => {
  it("shows all 31 objects at once and offers no Load more control", async () => {
    await mount();
    expect(screen.getByText("photo-29.webp")).toBeInTheDocument();
    expect(screen.getByText("clip.mp4")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Load more|Cargar más|Показать ещё/ })).not.toBeInTheDocument();
    expect(screen.getByText("Showing 31 of 31")).toBeInTheDocument();
  });

  it("keeps images lazy so a full render does not decode everything at once", async () => {
    const { view } = await mount();
    const imgs = view.container.querySelectorAll("img");
    expect(imgs.length).toBe(30);
    expect(Array.from(imgs).every((i) => i.getAttribute("loading") === "lazy")).toBe(true);
  });
});

describe("library filters survive a remount", () => {
  it("restores category, search and sort from localStorage without a default flash", async () => {
    const { user, view } = await mount();
    await user.type(screen.getByLabelText("Search by name"), "clip");
    await waitFor(() => expect(screen.queryByText("photo-00.webp")).not.toBeInTheDocument());
    view.unmount();

    render(
      <I18nProvider>
        <DashboardMedia />
      </I18nProvider>,
    );
    await screen.findByText("clip.mp4");
    expect(screen.queryByText("photo-00.webp")).not.toBeInTheDocument();
  });

  it("Reset clears the persisted key, returns kind=all and closes the advanced panel", async () => {
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify({
      v: 1, filters: { ...DEFAULT_FILTERS, kind: "video", q: "clip" }, open: true,
    }));
    const { user } = await mount("clip.mp4");
    // Restored state: only the video is listed and the panel is expanded.
    expect(screen.queryByText("photo-00.webp")).not.toBeInTheDocument();
    expect(screen.getByText("File type")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reset" }));
    await screen.findByText("photo-00.webp");
    expect(screen.queryByText("File type")).not.toBeInTheDocument();
    expect(localStorage.getItem(FILTERS_STORAGE_KEY)).toBe(JSON.stringify({ v: 1, filters: DEFAULT_FILTERS, open: false }));
  });

  it("runs exactly one batch usage scan when a used/unused filter is restored", async () => {
    checkMediaUsageBatch.mockResolvedValue({ usage: { "clip.mp4": 2 } });
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify({
      v: 1, filters: { ...DEFAULT_FILTERS, usage: "used" }, open: false,
    }));
    await mount("clip.mp4");
    await waitFor(() => expect(checkMediaUsageBatch).toHaveBeenCalledTimes(1));
    // No repeated polling once the answer is in.
    await new Promise((r) => setTimeout(r, 50));
    expect(checkMediaUsageBatch).toHaveBeenCalledTimes(1);
  });

  it("ignores a corrupted payload and starts from the defaults", async () => {
    localStorage.setItem(FILTERS_STORAGE_KEY, "{{{");
    await mount();
    expect(screen.getByText("photo-00.webp")).toBeInTheDocument();
    expect(screen.getByText("clip.mp4")).toBeInTheDocument();
  });
});
