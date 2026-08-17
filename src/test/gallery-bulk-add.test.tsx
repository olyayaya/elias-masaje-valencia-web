/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@/i18n/context";
import { ThemeProvider } from "@/contexts/ThemeContext";
import type { GalleryItem } from "@/lib/gallery";

/**
 * Bulk add from the Library into the gallery: what actually gets written, and
 * what happens to the picker when the write fails.
 */

const h = vi.hoisted(() => ({
  insert: vi.fn(async (_rows: Record<string, unknown>[]) => ({ error: null as null | { message: string } })),
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), message: vi.fn() },
  files: [] as { name: string; mimeType: string }[],
}));

vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("@/lib/storage-list", () => ({ listAllMediaObjects: async () => h.files }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ insert: h.insert, update: () => ({ eq: async () => ({ error: null }) }), delete: () => ({ eq: async () => ({ error: null }) }) }),
    rpc: async () => ({ error: null }),
    storage: {
      from: () => ({
        list: async () => ({ data: [], error: null }),
        getPublicUrl: (n: string) => ({ data: { publicUrl: `https://cdn.test/${n}` } }),
      }),
    },
  },
}));

const item = (id: string, url: string, order: number): GalleryItem => ({
  id,
  media_type: "photo",
  media_url: url,
  poster_url: "",
  title_es: "", title_en: "", title_ru: "",
  description_es: "", description_en: "", description_ru: "",
  alt_es: "", alt_en: "", alt_ru: "",
  sort_order: order,
  published: true,
  duration_seconds: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
});

const existing = [item("g1", "https://cdn.test/a.webp", 4)];

vi.mock("@/hooks/use-gallery", () => ({
  useGallery: () => ({ data: existing, isPending: false, missingTable: false }),
  useGalleryAdmin: () => ({ data: existing, isPending: false, missingTable: false }),
}));

import DashboardGallery from "@/components/dashboard/DashboardGallery";

const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <ThemeProvider>
          <MemoryRouter>
            <DashboardGallery />
          </MemoryRouter>
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>,
  );

const openPhotoPicker = async () => {
  mount();
  fireEvent.click(screen.getByRole("button", { name: /add photo|añadir foto|добавить фото/i }));
  const dialog = await screen.findByRole("dialog");
  await waitFor(() => expect(dialog.querySelectorAll("button[title]").length).toBeGreaterThan(0));
  return dialog;
};

const tilesOf = (dialog: HTMLElement) => Array.from(dialog.querySelectorAll("button[title]")) as HTMLElement[];

beforeEach(() => {
  vi.clearAllMocks();
  h.insert.mockImplementation(async () => ({ error: null }));
  h.files = [
    { name: "a.webp", mimeType: "image/webp" },
    { name: "b.webp", mimeType: "image/webp" },
    { name: "c.webp", mimeType: "image/webp" },
  ];
});
afterEach(cleanup);

describe("gallery bulk add", () => {
  it("inserts every new file unpublished, with empty posters and continuing sort order", async () => {
    const dialog = await openPhotoPicker();
    const tiles = tilesOf(dialog);
    fireEvent.click(tiles[1]);
    fireEvent.click(tiles[2]);
    fireEvent.click(within(dialog).getByRole("button", { name: /add 2|añadir 2|добавить 2/i }));

    await waitFor(() => expect(h.insert).toHaveBeenCalled());
    expect(h.insert.mock.calls[0][0]).toEqual([
      { media_type: "photo", media_url: "https://cdn.test/b.webp", poster_url: "", sort_order: 5, published: false },
      { media_type: "photo", media_url: "https://cdn.test/c.webp", poster_url: "", sort_order: 6, published: false },
    ]);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("skips files already in the gallery", async () => {
    const dialog = await openPhotoPicker();
    fireEvent.click(within(dialog).getByRole("button", { name: /select all visible|seleccionar todo|выбрать всё/i }));
    fireEvent.click(within(dialog).getByRole("button", { name: /add 3|añadir 3|добавить 3/i }));

    await waitFor(() => expect(h.insert).toHaveBeenCalled());
    const rows = h.insert.mock.calls[0][0] as { media_url: string }[];
    expect(rows.map((r) => r.media_url)).toEqual(["https://cdn.test/b.webp", "https://cdn.test/c.webp"]);
  });

  it("writes nothing when every selected file is already in the gallery", async () => {
    h.files = [{ name: "a.webp", mimeType: "image/webp" }];
    const dialog = await openPhotoPicker();
    fireEvent.click(tilesOf(dialog)[0]);
    fireEvent.click(within(dialog).getByRole("button", { name: /add 1|añadir 1|добавить 1/i }));

    await waitFor(() => expect(h.toast.message).toHaveBeenCalled());
    expect(h.insert).not.toHaveBeenCalled();
  });

  it("keeps the picker open with the selection intact when the insert fails", async () => {
    h.insert.mockImplementation(async () => ({ error: { message: "boom" } }));
    const dialog = await openPhotoPicker();
    fireEvent.click(tilesOf(dialog)[1]);
    fireEvent.click(within(dialog).getByRole("button", { name: /add 1|añadir 1|добавить 1/i }));

    await waitFor(() => expect(h.toast.error).toHaveBeenCalled());
    expect(screen.getByRole("dialog")).toBeTruthy();
    // Selection survives so the admin can simply press the button again.
    expect(tilesOf(screen.getByRole("dialog"))[1].getAttribute("aria-selected")).toBe("true");
  });

  it("keeps a shift range consistent with what the search left visible", async () => {
    h.files = [
      { name: "b1.webp", mimeType: "image/webp" },
      { name: "b2.webp", mimeType: "image/webp" },
      { name: "c1.webp", mimeType: "image/webp" },
    ];
    const dialog = await openPhotoPicker();
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "b" } });
    await waitFor(() => expect(tilesOf(dialog)).toHaveLength(2));
    const tiles = tilesOf(dialog);
    fireEvent.click(tiles[0]);
    fireEvent.click(tiles[1], { shiftKey: true });
    fireEvent.click(within(dialog).getByRole("button", { name: /add 2|añadir 2|добавить 2/i }));

    await waitFor(() => expect(h.insert).toHaveBeenCalled());
    const rows = h.insert.mock.calls[0][0] as { media_url: string }[];
    expect(rows.map((r) => r.media_url)).toEqual(["https://cdn.test/b1.webp", "https://cdn.test/b2.webp"]);
  });
});
