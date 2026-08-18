/* @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@/i18n/context";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { storageThumbUrl, type GalleryItem } from "@/lib/gallery";
import { es } from "@/i18n/es";
import { en } from "@/i18n/en";
import { ru } from "@/i18n/ru";

const SUPA_ORIGIN = new URL(import.meta.env.VITE_SUPABASE_URL as string).origin;
const photoUrl = `${SUPA_ORIGIN}/storage/v1/object/public/media/sala.webp`;

const rows: GalleryItem[] = [
  {
    id: "1",
    media_type: "photo",
    media_url: photoUrl,
    poster_url: "",
    title_es: "Sala", title_en: "Room", title_ru: "Зал",
    description_es: "", description_en: "", description_ru: "",
    alt_es: "Sala de masaje", alt_en: "Massage room", alt_ru: "Массажный зал",
    sort_order: 1, published: true, duration_seconds: null,
    thumbnail_x: 50, thumbnail_y: 50, thumbnail_zoom: 1,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "2",
    media_type: "video",
    media_url: `${SUPA_ORIGIN}/storage/v1/object/public/media/clip.mp4`,
    poster_url: `${SUPA_ORIGIN}/storage/v1/object/public/media/clip-cover.webp`,
    title_es: "Sesión", title_en: "Session", title_ru: "Сеанс",
    description_es: "", description_en: "", description_ru: "",
    alt_es: "Sesión", alt_en: "Session", alt_ru: "Сеанс",
    sort_order: 2, published: true, duration_seconds: 30,
    thumbnail_x: 50, thumbnail_y: 50, thumbnail_zoom: 1,
    created_at: "2026-01-02T00:00:00Z", updated_at: "2026-01-02T00:00:00Z",
  },
];

vi.mock("@/hooks/use-gallery", () => ({
  useGallery: () => ({ data: rows, isPending: false, missingTable: false }),
  useGalleryAdmin: () => ({ data: rows, isPending: false, missingTable: false }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ order: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) }) }),
    storage: { from: () => ({ list: () => Promise.resolve({ data: [], error: null }), getPublicUrl: () => ({ data: { publicUrl: "" } }) }) },
  },
}));

import Galeria from "@/pages/Galeria";

const renderPage = (path: string) => {
  // The i18n provider resolves the locale from the real location, not the router.
  window.history.replaceState({}, "", path);
  return render(
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
};

afterEach(cleanup);

const head = () => ({
  canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
  alternates: Array.from(document.querySelectorAll('link[rel="alternate"]')).map((l) => ({
    hreflang: l.getAttribute("hreflang"),
    href: l.getAttribute("href"),
  })),
});

describe("gallery routes", () => {
  const cases = [
    { path: "/galeria", h1: es.gallery.title, title: es.gallery.metaTitle, canonical: "https://eliasmas.es/galeria" },
    { path: "/en/gallery", h1: en.gallery.title, title: en.gallery.metaTitle, canonical: "https://eliasmas.es/en/gallery" },
    { path: "/ru/galereya", h1: ru.gallery.title, title: ru.gallery.metaTitle, canonical: "https://eliasmas.es/ru/galereya" },
  ];

  for (const cse of cases) {
    it(`renders ${cse.path} with its H1, title, canonical and full hreflang set`, async () => {
      renderPage(cse.path);
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(cse.h1);
      await waitFor(() => expect(head().canonical).toBe(cse.canonical));
      await waitFor(() => expect(document.title).toBe(cse.title));
      const alts = head().alternates;
      expect(alts.map((a) => a.hreflang).sort()).toEqual(["en", "es", "ru", "x-default"]);
      expect(alts.find((a) => a.hreflang === "es")?.href).toBe("https://eliasmas.es/galeria");
      expect(alts.find((a) => a.hreflang === "en")?.href).toBe("https://eliasmas.es/en/gallery");
      expect(alts.find((a) => a.hreflang === "ru")?.href).toBe("https://eliasmas.es/ru/galereya");
      expect(alts.find((a) => a.hreflang === "x-default")?.href).toBe("https://eliasmas.es/galeria");
    });
  }
});

describe("grid vs. lightbox sources", () => {
  it("uses the bounded derivative in the grid and never preloads the original", () => {
    renderPage("/galeria");
    const img = screen.getByAltText("Sala de masaje") as HTMLImageElement;
    const derivative = storageThumbUrl(photoUrl)!;
    expect(img.getAttribute("src")).toBe(derivative);
    // The original is only remembered for the onError fallback — it is not requested.
    expect(img.getAttribute("data-full-src")).toBe(photoUrl);
    const srcs = Array.from(document.querySelectorAll("img")).map((i) => i.getAttribute("src"));
    expect(srcs).not.toContain(photoUrl);
  });

  it("falls back to the original only when the derivative fails", () => {
    renderPage("/galeria");
    const img = screen.getByAltText("Sala de masaje") as HTMLImageElement;
    fireEvent.error(img);
    expect(img.getAttribute("src")).toBe(photoUrl);
  });

  it("shows the full-size original inside the lightbox", async () => {
    renderPage("/galeria");
    fireEvent.click(screen.getByTestId("gallery-photo-thumb"));
    const dialog = await screen.findByRole("dialog");
    const img = dialog.querySelector("img") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe(photoUrl);
  });
});

describe("lightbox interaction", () => {
  const swipe = (el: Element, from: number, to: number) => {
    fireEvent.touchStart(el, { touches: [{ clientX: from }] });
    fireEvent.touchEnd(el, { changedTouches: [{ clientX: to }] });
  };

  it("navigates forward and back with swipes", async () => {
    renderPage("/galeria");
    fireEvent.click(screen.getByTestId("gallery-photo-thumb"));
    const box = await screen.findByTestId("gallery-lightbox");
    swipe(box, 300, 100); // swipe left → next
    await waitFor(() => expect(document.querySelector('[data-testid="gallery-lightbox"] video')).toBeTruthy());
    swipe(screen.getByTestId("gallery-lightbox"), 100, 300); // swipe right → previous
    await waitFor(() => expect(document.querySelector('[data-testid="gallery-lightbox"] img')).toBeTruthy());
  });

  it("pauses and rewinds the video on navigation and on close", async () => {
    const pause = vi.fn();
    const proto = window.HTMLMediaElement.prototype as unknown as { pause: () => void };
    const original = proto.pause;
    proto.pause = pause;
    try {
      renderPage("/galeria");
      fireEvent.click(screen.getByTestId("gallery-video-thumb"));
      const dialog = await screen.findByRole("dialog");
      const video = dialog.querySelector("video") as HTMLVideoElement;
      video.currentTime = 5;
      fireEvent.keyDown(document, { key: "ArrowRight" });
      await waitFor(() => expect(pause).toHaveBeenCalled());
      expect(video.currentTime).toBe(0);

      pause.mockClear();
      fireEvent.keyDown(document, { key: "ArrowRight" });
      await screen.findByRole("dialog");
      fireEvent.keyDown(document, { key: "Escape" });
      await waitFor(() => expect(screen.queryByTestId("gallery-lightbox")).toBeNull());
      expect(pause).toHaveBeenCalled();
      expect(document.querySelectorAll("video").length).toBe(0);
    } finally {
      proto.pause = original;
    }
  });

  it("gives focus back to the thumbnail that opened it", async () => {
    renderPage("/galeria");
    const opener = screen.getByTestId("gallery-photo-thumb");
    opener.focus();
    fireEvent.click(opener);
    await screen.findByRole("dialog");
    await waitFor(() => expect(document.activeElement).not.toBe(opener));
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});
