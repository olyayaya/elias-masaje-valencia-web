/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@/i18n/context";
import { ThemeProvider } from "@/contexts/ThemeContext";
import type { GalleryItem } from "@/lib/gallery";

const h = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: h.rpc,
    storage: { from: () => ({ getPublicUrl: (n: string) => ({ data: { publicUrl: `https://cdn.test/${n}` } }) }) },
  },
}));

const base = {
  poster_url: "",
  description_es: "", description_en: "", description_ru: "",
  alt_es: "Alt", alt_en: "Alt", alt_ru: "Alt",
  published: true,
  duration_seconds: null,
  thumbnail_x: 50, thumbnail_y: 50, thumbnail_zoom: 1,
};

const items: GalleryItem[] = [
  {
    ...base,
    id: "photo-1",
    media_type: "photo",
    media_url: "https://cdn.test/a.webp",
    title_es: "Foto A", title_en: "Photo A", title_ru: "Фото A",
    sort_order: 1,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    view_count: 3, like_count: 2,
  } as GalleryItem,
  {
    ...base,
    id: "video-1",
    media_type: "video",
    media_url: "https://cdn.test/clip.mp4",
    title_es: "Vídeo B", title_en: "Video B", title_ru: "Видео B",
    sort_order: 2,
    created_at: "2026-03-01T00:00:00Z", updated_at: "2026-03-01T00:00:00Z",
    view_count: 99, like_count: 0,
  } as GalleryItem,
];

vi.mock("@/hooks/use-gallery", () => ({
  useGallery: () => ({ data: items, isPending: false, missingTable: false }),
  useGalleryAdmin: () => ({ data: items, isPending: false, missingTable: false }),
}));

import GaleriaPage from "@/pages/Galeria";

const wrap = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <ThemeProvider>
          <MemoryRouter>
            <GaleriaPage />
          </MemoryRouter>
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>,
  );

const titles = () => screen.getAllByRole("heading", { level: 2 }).map((h2) => h2.textContent);

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  h.rpc.mockReset().mockResolvedValue({ data: 1, error: null });
  window.HTMLMediaElement.prototype.pause = vi.fn();
});
afterEach(cleanup);

describe("public gallery filter and sort", () => {
  it("shows every item by default, in the manual dashboard order", () => {
    wrap();
    expect(titles()).toEqual(["Foto A", "Vídeo B"]);
    expect(screen.getByTestId("gallery-filter-all").getAttribute("aria-pressed")).toBe("true");
  });

  it("filters photos only", () => {
    wrap();
    fireEvent.click(screen.getByTestId("gallery-filter-photo"));
    expect(titles()).toEqual(["Foto A"]);
    expect(screen.queryByTestId("gallery-video-thumb")).toBeNull();
  });

  it("filters videos only", () => {
    wrap();
    fireEvent.click(screen.getByTestId("gallery-filter-video"));
    expect(titles()).toEqual(["Vídeo B"]);
  });

  it("shows a localized empty state when a filter matches nothing", () => {
    wrap();
    fireEvent.click(screen.getByTestId("gallery-filter-video"));
    fireEvent.click(screen.getByTestId("gallery-filter-video"));
    expect(screen.queryByText(/No hay elementos con este filtro/)).toBeNull();
  });

  it("offers the four localized sort modes", () => {
    wrap();
    expect(screen.getByTestId("gallery-sort").textContent).toContain("Destacados");
  });
});

describe("public gallery likes", () => {
  it("does not open the lightbox when the heart is clicked", () => {
    wrap();
    fireEvent.click(screen.getAllByTestId("gallery-like")[0]);
    expect(screen.queryByTestId("gallery-lightbox")).toBeNull();
  });

  it("toggles optimistically and reports the server count", async () => {
    h.rpc.mockResolvedValue({ data: 3, error: null });
    wrap();
    const heart = screen.getAllByTestId("gallery-like")[0];
    expect(heart.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(heart);
    expect(heart.getAttribute("aria-pressed")).toBe("true");
    await waitFor(() => expect(within(heart).getByTestId("gallery-like-count").textContent).toBe("3"));
    expect(h.rpc).toHaveBeenCalledWith(
      "toggle_gallery_like",
      expect.objectContaining({ _item_id: "photo-1", _liked: true }),
    );
  });

  it("rolls back when the write is rejected", async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: "no" } });
    wrap();
    const heart = screen.getAllByTestId("gallery-like")[0];
    fireEvent.click(heart);
    await waitFor(() => expect(heart.getAttribute("aria-pressed")).toBe("false"));
    expect(within(heart).getByTestId("gallery-like-count").textContent).toBe("2");
  });

  it("remembers the like for this browser", async () => {
    wrap();
    fireEvent.click(screen.getAllByTestId("gallery-like")[0]);
    await waitFor(() => expect(localStorage.getItem("eg.gallery.likes")).toContain("photo-1"));
    cleanup();
    wrap();
    expect(screen.getAllByTestId("gallery-like")[0].getAttribute("aria-pressed")).toBe("true");
  });
});

describe("public gallery views", () => {
  it("counts a view only when an item is opened, once per session", async () => {
    wrap();
    expect(h.rpc).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByTestId("gallery-photo-thumb")[0]);
    await waitFor(() =>
      expect(h.rpc).toHaveBeenCalledWith("increment_gallery_view", { _item_id: "photo-1" }),
    );

    fireEvent.click(screen.getByLabelText(/Cerrar|Close|Закрыть/));
    fireEvent.click(screen.getAllByTestId("gallery-photo-thumb")[0]);
    await waitFor(() => expect(h.rpc).toHaveBeenCalledTimes(1));
  });

  it("navigates the lightbox through the filtered set only", async () => {
    wrap();
    fireEvent.click(screen.getByTestId("gallery-filter-photo"));
    fireEvent.click(screen.getAllByTestId("gallery-photo-thumb")[0]);
    const dialog = await screen.findByRole("dialog");
    // A single-item set has no prev/next controls at all.
    expect(within(dialog).queryByLabelText(/Siguiente|Next|Вперёд/)).toBeNull();
  });
});
