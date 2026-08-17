/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@/i18n/context";
import { ThemeProvider } from "@/contexts/ThemeContext";
import type { GalleryItem } from "@/lib/gallery";

const h = vi.hoisted(() => {
  const insert = vi.fn(async (_payload: Record<string, unknown>) => ({ error: null as null | { message: string } }));
  const updateEq = vi.fn(async () => ({ error: null as null | { message: string } }));
  const update = vi.fn((_payload: Record<string, unknown>) => ({ eq: updateEq }));
  const del = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));
  const rpc = vi.fn(async () => ({ error: null as null | { code?: string; message?: string } }));
  const list = vi.fn(async (_p: string, _o: { limit: number; offset: number }) => ({
    data: [] as { name: string; metadata?: { mimetype?: string } }[] | null,
    error: null as null | { message: string },
  }));
  const upload = vi.fn(async () => ({ error: null as null | { message: string } }));
  const remove = vi.fn(async () => ({ data: null, error: null }));
  const generatePoster = vi.fn(
    async (_o: { videoUrl: string; signal?: AbortSignal; onProgress?: (r: number) => void }) => ({
      blob: new Blob(["x"]),
      width: 10,
      height: 10,
      ext: "webp" as const,
      mimeType: "image/webp",
      source: "canvas" as const,
    }),
  );
  return { insert, update, updateEq, del, rpc, list, upload, remove, generatePoster };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ insert: h.insert, update: h.update, delete: h.del }),
    rpc: h.rpc,
    storage: {
      from: () => ({
        list: h.list,
        upload: h.upload,
        remove: h.remove,
        getPublicUrl: (name: string) => ({ data: { publicUrl: `https://cdn.test/${name}` } }),
      }),
    },
  },
}));

vi.mock("@/lib/gallery-poster", () => ({
  generatePoster: h.generatePoster,
  posterNameFor: () => "new-cover.webp",
}));

const items: GalleryItem[] = [
  {
    id: "photo-1",
    media_type: "photo",
    media_url: "https://cdn.test/a.webp",
    poster_url: "",
    title_es: "A", title_en: "", title_ru: "",
    description_es: "", description_en: "", description_ru: "",
    alt_es: "A", alt_en: "", alt_ru: "",
    sort_order: 1, published: false, duration_seconds: null,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "video-1",
    media_type: "video",
    media_url: "https://cdn.test/clip.mp4",
    poster_url: "",
    title_es: "B", title_en: "", title_ru: "",
    description_es: "", description_en: "", description_ru: "",
    alt_es: "B", alt_en: "", alt_ru: "",
    sort_order: 2, published: false, duration_seconds: null,
    created_at: "2026-01-02T00:00:00Z", updated_at: "2026-01-02T00:00:00Z",
  },
];

vi.mock("@/hooks/use-gallery", () => ({
  useGallery: () => ({ data: items, isPending: false, missingTable: false }),
  useGalleryAdmin: () => ({ data: items, isPending: false, missingTable: false }),
}));

import DashboardGallery from "@/components/dashboard/DashboardGallery";

const wrap = () =>
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

const pageOf = (names: string[]) => ({
  data: names.map((name) => ({ name, metadata: { mimetype: name.endsWith(".mp4") ? "video/mp4" : "image/webp" } })),
  error: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.list.mockImplementation(async () => pageOf([]));
  h.updateEq.mockImplementation(async () => ({ error: null }));
  h.upload.mockImplementation(async () => ({ error: null }));
  h.rpc.mockImplementation(async () => ({ error: null }));
});
afterEach(cleanup);

/** Opens the "add photo" picker and selects the first tile. */
const addFirstPhoto = async () => {
  fireEvent.click(screen.getByRole("button", { name: /Añadir foto|Add photo|Добавить фото/ }));
  const dialog = await screen.findByRole("dialog");
  await waitFor(() => expect(dialog.querySelectorAll("img").length).toBeGreaterThan(0));
  fireEvent.click(dialog.querySelectorAll("button[title]")[0]);
  fireEvent.click(within(dialog).getByRole("button", { name: /Seleccionar|Select|Выбрать/ }));
};

describe("insert payload", () => {
  it("never gives a photo a poster_url", async () => {
    h.list.mockImplementation(async () => pageOf(["one.webp"]));
    wrap();
    await addFirstPhoto();
    await waitFor(() => expect(h.insert).toHaveBeenCalled());
    expect(h.insert.mock.calls[0][0]).toMatchObject({
      media_type: "photo",
      media_url: "https://cdn.test/one.webp",
      poster_url: "",
      published: false,
    });
  });
});

describe("replace payload", () => {
  it("clears the poster when a photo file is replaced", async () => {
    h.list.mockImplementation(async () => pageOf(["two.webp"]));
    wrap();
    fireEvent.click(screen.getAllByRole("button", { name: /Cambiar archivo|Change file|Заменить файл/ })[0]);
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.querySelectorAll("button[title]").length).toBeGreaterThan(0));
    fireEvent.click(dialog.querySelectorAll("button[title]")[0]);
    fireEvent.click(within(dialog).getByRole("button", { name: /Seleccionar|Select|Выбрать/ }));
    await waitFor(() => expect(h.update).toHaveBeenCalled());
    expect(h.update.mock.calls[0][0]).toEqual({
      media_url: "https://cdn.test/two.webp",
      poster_url: "",
    });
  });
});

describe("reorder", () => {
  it("only ever swaps through the transactional RPC", async () => {
    wrap();
    const downs = screen.getAllByRole("button").filter((b) => b.querySelector(".lucide-chevron-down"));
    fireEvent.click(downs[0]);
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith("swap_gallery_order", { _a: "photo-1", _b: "video-1" }));
    expect(h.update).not.toHaveBeenCalled();
  });

  it("writes nothing when the RPC is missing or fails", async () => {
    h.rpc.mockImplementation(async () => ({ error: { code: "PGRST202", message: "Could not find the function" } }));
    wrap();
    const downs = screen.getAllByRole("button").filter((b) => b.querySelector(".lucide-chevron-down"));
    fireEvent.click(downs[0]);
    await waitFor(() => expect(h.rpc).toHaveBeenCalled());
    expect(h.update).not.toHaveBeenCalled();
  });
});

describe("media picker", () => {
  it("loads every page of the bucket, not just the first", async () => {
    h.list.mockImplementation(async (_p, o) =>
      o.offset === 0
        ? pageOf(Array.from({ length: 100 }, (_, i) => `p${i}.webp`))
        : pageOf(["last-one.webp"]),
    );
    wrap();
    fireEvent.click(screen.getByRole("button", { name: /Añadir foto|Add photo|Добавить фото/ }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.querySelectorAll("button[title]").length).toBe(101));
    // The search box filters the FULL loaded set, including later pages.
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "last-one" } });
    await waitFor(() => expect(dialog.querySelectorAll("button[title]").length).toBe(1));
  });

  it("shows a retryable error when storage listing fails", async () => {
    h.list.mockImplementation(async () => ({ data: null, error: { message: "boom" } }));
    wrap();
    fireEvent.click(screen.getByRole("button", { name: /Añadir foto|Add photo|Добавить фото/ }));
    const err = await screen.findByTestId("picker-error");
    expect(err).toBeTruthy();
    h.list.mockImplementation(async () => pageOf(["ok.webp"]));
    fireEvent.click(within(err).getByRole("button"));
    await waitFor(() => expect(screen.queryByTestId("picker-error")).toBeNull());
    expect((await screen.findByRole("dialog")).querySelectorAll("button[title]").length).toBe(1);
  });
});

describe("cover generation", () => {
  const clickGenerate = () =>
    fireEvent.click(screen.getByRole("button", { name: /Generar portada|Generate cover|Создать обложку/ }));

  it("does not touch the poster module or Storage on render alone", () => {
    wrap();
    expect(h.generatePoster).not.toHaveBeenCalled();
    expect(h.upload).not.toHaveBeenCalled();
    expect(h.remove).not.toHaveBeenCalled();
  });

  it("reports numeric progress through an accessible progressbar", async () => {
    let report: ((r: number) => void) | undefined;
    h.generatePoster.mockImplementation(
      (o) =>
        new Promise((resolve) => {
          report = (r) => {
            o.onProgress?.(r);
            resolve({ blob: new Blob(["x"]), width: 1, height: 1, ext: "webp", mimeType: "image/webp", source: "canvas" });
          };
        }),
    );
    wrap();
    clickGenerate();
    const bar = await screen.findByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("0");
    report!(0.5);
    await waitFor(() => expect(h.upload).toHaveBeenCalled());
    expect(Number(screen.queryByRole("progressbar")?.getAttribute("aria-valuenow") ?? 100)).toBeGreaterThan(0);
  });

  it("cancels from the visible button and uploads nothing", async () => {
    h.generatePoster.mockImplementation(
      (o) =>
        new Promise((_resolve, reject) => {
          o.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "PosterAbortError";
            reject(err);
          });
        }),
    );
    wrap();
    clickGenerate();
    const progress = await screen.findByTestId("cover-progress");
    fireEvent.click(within(progress).getByRole("button"));
    await waitFor(() => expect(screen.queryByTestId("cover-progress")).toBeNull());
    expect(h.upload).not.toHaveBeenCalled();
    expect(h.remove).not.toHaveBeenCalled();
  });

  it("surfaces a generation error without writing to Storage", async () => {
    h.generatePoster.mockImplementation(async () => {
      throw new Error("cannot decode");
    });
    wrap();
    clickGenerate();
    await waitFor(() => expect(screen.queryByTestId("cover-progress")).toBeNull());
    expect(h.upload).not.toHaveBeenCalled();
    expect(h.remove).not.toHaveBeenCalled();
  });

  it("keeps the source untouched when the upload itself fails", async () => {
    h.upload.mockImplementation(async () => ({ error: { message: "upload failed" } }));
    wrap();
    clickGenerate();
    await waitFor(() => expect(h.upload).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId("cover-progress")).toBeNull());
    expect(h.remove).not.toHaveBeenCalled();
    expect(h.update).not.toHaveBeenCalled();
  });

  it("deletes only the new derivative when the DB patch fails", async () => {
    h.updateEq.mockImplementation(async () => ({ error: { message: "denied" } }));
    wrap();
    clickGenerate();
    await waitFor(() => expect(h.remove).toHaveBeenCalledWith(["new-cover.webp"]));
    expect(h.remove).toHaveBeenCalledTimes(1);
  });

  it("stores the cover and never lists a single truncated page", async () => {
    h.list.mockImplementation(async (_p, o) =>
      o.offset === 0 ? pageOf(Array.from({ length: 100 }, (_, i) => `x${i}.webp`)) : pageOf(["y.webp"]),
    );
    wrap();
    clickGenerate();
    await waitFor(() => expect(h.update).toHaveBeenCalledWith({ poster_url: "https://cdn.test/new-cover.webp" }));
    expect(h.list.mock.calls.length).toBeGreaterThan(1);
    expect(h.remove).not.toHaveBeenCalled();
  });
});
