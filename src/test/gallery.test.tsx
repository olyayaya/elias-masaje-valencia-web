/* @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@/i18n/context";
import { ThemeProvider } from "@/contexts/ThemeContext";
import {
  buildGallerySchema,
  isMissingGalleryTable,
  isoDuration,
  pickLocalized,
  thumbnailFor,
  type GalleryItem,
} from "@/lib/gallery";
import { ROUTE_MAP, getAlternates } from "@/config/routes";

const rows: GalleryItem[] = [
  {
    id: "1",
    media_type: "photo",
    media_url: "https://cdn.test/photo.webp",
    poster_url: "",
    title_es: "Sala", title_en: "Room", title_ru: "",
    description_es: "Espacio", description_en: "Space", description_ru: "",
    alt_es: "Sala de masaje", alt_en: "Massage room", alt_ru: "",
    sort_order: 1, published: true, duration_seconds: null,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "2",
    media_type: "video",
    media_url: "https://cdn.test/clip.mp4",
    poster_url: "https://cdn.test/clip-poster.webp",
    title_es: "Sesión", title_en: "Session", title_ru: "Сеанс",
    description_es: "", description_en: "", description_ru: "",
    alt_es: "Sesión de masaje", alt_en: "", alt_ru: "",
    sort_order: 2, published: true, duration_seconds: 95,
    created_at: "2026-01-02T00:00:00Z", updated_at: "2026-01-02T00:00:00Z",
  },
];

vi.mock("@/hooks/use-gallery", () => ({
  useGallery: () => ({ data: rows, isPending: false }),
  useGalleryAdmin: () => ({ data: rows, isPending: false }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ order: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) }) }),
    storage: { from: () => ({ list: () => Promise.resolve({ data: [] }), getPublicUrl: () => ({ data: { publicUrl: "" } }) }) },
  },
}));

import Galeria from "@/pages/Galeria";

const renderPage = (path: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <ThemeProvider>
          <MemoryRouter initialEntries={[path]}>
            <Galeria />
          </MemoryRouter>
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>,
  );

afterEach(cleanup);

describe("gallery helpers", () => {
  it("falls back to Spanish when a localized field is empty", () => {
    expect(pickLocalized(rows[0], "title", "en")).toBe("Room");
    expect(pickLocalized(rows[0], "title", "ru")).toBe("Sala");
    expect(pickLocalized(rows[1], "alt", "ru")).toBe("Sesión de masaje");
  });

  it("uses the poster as the video thumbnail (never the video itself)", () => {
    expect(thumbnailFor(rows[1])).toBe("https://cdn.test/clip-poster.webp");
    expect(thumbnailFor(rows[0])).toBe("https://cdn.test/photo.webp");
  });

  it("formats ISO durations", () => {
    expect(isoDuration(95)).toBe("PT1M35S");
    expect(isoDuration(0)).toBeUndefined();
    expect(isoDuration(null)).toBeUndefined();
  });

  it("treats a missing table as an empty gallery, not an error", () => {
    expect(isMissingGalleryTable({ code: "42P01", message: "relation does not exist" })).toBe(true);
    expect(isMissingGalleryTable({ code: "PGRST205", message: "Could not find the table" })).toBe(true);
    expect(isMissingGalleryTable({ code: "23505", message: "duplicate key" })).toBe(false);
    expect(isMissingGalleryTable(null)).toBe(false);
  });

  it("builds ImageGallery JSON-LD with ImageObject and VideoObject members", () => {
    const schema = buildGallerySchema(rows, "es");
    expect(schema["@type"]).toBe("ImageGallery");
    expect(schema.url).toBe(`https://eliasmas.es${ROUTE_MAP.gallery.es}`);
    const types = schema.hasPart.map((p) => p["@type"]);
    expect(types).toEqual(["ImageObject", "VideoObject"]);
    const video = schema.hasPart[1] as Record<string, unknown>;
    expect(video.duration).toBe("PT1M35S");
    expect(video.thumbnailUrl).toBe("https://cdn.test/clip-poster.webp");
  });

  it("exposes hreflang alternates for all three locales", () => {
    const alts = getAlternates("gallery").map((a) => a.href);
    expect(alts).toContain("https://eliasmas.es/galeria");
    expect(alts).toContain("https://eliasmas.es/en/gallery");
    expect(alts).toContain("https://eliasmas.es/ru/galereya");
  });
});

describe("gallery page", () => {
  it("renders thumbnails and does not autoplay videos", () => {
    renderPage("/galeria");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Galería");
    expect(document.querySelectorAll("video").length).toBe(0);
    const img = screen.getByAltText("Sala de masaje") as HTMLImageElement;
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(screen.getByTestId("gallery-video-thumb")).toBeTruthy();
  });

  it("opens the lightbox with a controllable video and closes it", async () => {
    renderPage("/galeria");
    fireEvent.click(screen.getByTestId("gallery-video-thumb"));
    const dialog = await screen.findByRole("dialog");
    const video = dialog.querySelector("video") as HTMLVideoElement;
    expect(video).toBeTruthy();
    expect(video.hasAttribute("autoplay")).toBe(false);
    expect(video.hasAttribute("controls")).toBe(true);
    expect(video.getAttribute("poster")).toBe("https://cdn.test/clip-poster.webp");

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("gallery-lightbox")).toBeNull());
    expect(document.querySelectorAll("video").length).toBe(0);
  });

  it("navigates between items with the arrow keys", async () => {
    renderPage("/galeria");
    fireEvent.click(screen.getByTestId("gallery-photo-thumb"));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector("img")).toBeTruthy();
    fireEvent.keyDown(document, { key: "ArrowRight" });
    await waitFor(() => expect(document.querySelector('[data-testid="gallery-lightbox"] video')).toBeTruthy());
  });
});
