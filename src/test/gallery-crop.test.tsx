/* @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { I18nProvider } from "@/i18n/context";
import { CROP_DEFAULTS, clampCrop, cropForSave, cropStyle } from "@/lib/gallery-crop";
import ThumbnailCropDialog, { CROP_COPY } from "@/components/dashboard/ThumbnailCropDialog";
import GalleryLightbox from "@/components/gallery/GalleryLightbox";
import type { GalleryItem } from "@/lib/gallery";

class RO { observe() {} unobserve() {} disconnect() {} }
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver ??= RO;

afterEach(cleanup);

const item = (over: Partial<GalleryItem> = {}): GalleryItem => ({
  id: "g1",
  media_type: "photo",
  media_url: "https://cdn.test/a.webp",
  poster_url: "",
  title_es: "Foto", title_en: "Photo", title_ru: "Фото",
  description_es: "", description_en: "", description_ru: "",
  alt_es: "alt", alt_en: "alt", alt_ru: "alt",
  sort_order: 1,
  published: true,
  duration_seconds: null,
  thumbnail_x: 50, thumbnail_y: 50, thumbnail_zoom: 1,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...over,
});

describe("crop helper", () => {
  it("defaults to a centered, unzoomed frame", () => {
    expect(clampCrop(undefined)).toEqual(CROP_DEFAULTS);
    const s = cropStyle(undefined);
    expect(s.objectFit).toBe("cover");
    expect(s.objectPosition).toBe("50% 50%");
    // Identical to the historic object-cover center rendering: no transform at all.
    expect(s.transform).toBeUndefined();
  });

  it("clamps out-of-range values and rejects NaN/Infinity", () => {
    expect(clampCrop({ thumbnail_x: -20, thumbnail_y: 480, thumbnail_zoom: 9 })).toEqual({
      thumbnail_x: 0, thumbnail_y: 100, thumbnail_zoom: 3,
    });
    expect(clampCrop({ thumbnail_x: NaN, thumbnail_y: Infinity, thumbnail_zoom: -Infinity })).toEqual(CROP_DEFAULTS);
    expect(clampCrop({ thumbnail_zoom: 0.2 }).thumbnail_zoom).toBe(1);
  });

  it("rounds values before saving", () => {
    expect(cropForSave({ thumbnail_x: 33.4, thumbnail_y: 12.6, thumbnail_zoom: 1.234 })).toEqual({
      thumbnail_x: 33, thumbnail_y: 13, thumbnail_zoom: 1.23,
    });
  });

  it("emits a scale + matching origin when zoomed", () => {
    const s = cropStyle({ thumbnail_x: 20, thumbnail_y: 80, thumbnail_zoom: 2 });
    expect(s.transform).toBe("scale(2)");
    expect(s.transformOrigin).toBe("20% 80%");
    expect(s.objectPosition).toBe("20% 80%");
  });

  it("produces one identical style for dashboard preview and public grid", () => {
    const crop = { thumbnail_x: 12, thumbnail_y: 88, thumbnail_zoom: 1.5 };
    expect(cropStyle(item(crop))).toEqual(cropStyle(crop));
  });
});

const wrap = (ui: React.ReactNode) => render(<I18nProvider>{ui}</I18nProvider>);

describe("thumbnail crop dialog", () => {
  it("saves only clamped crop values and closes", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const onCancel = vi.fn();
    wrap(
      <ThumbnailCropDialog
        open
        previewUrl="https://cdn.test/a.webp"
        value={{ thumbnail_x: 30, thumbnail_y: 70, thumbnail_zoom: 1.5 }}
        onCancel={onCancel}
        onSave={onSave}
      />,
    );
    fireEvent.click(screen.getByTestId("crop-save"));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ thumbnail_x: 30, thumbnail_y: 70, thumbnail_zoom: 1.5 }));
    await waitFor(() => expect(onCancel).toHaveBeenCalled());
  });

  it("does not close on a failed save", async () => {
    const onSave = vi.fn().mockResolvedValue(false);
    const onCancel = vi.fn();
    wrap(
      <ThumbnailCropDialog open previewUrl="https://cdn.test/a.webp" value={{}} onCancel={onCancel} onSave={onSave} />,
    );
    fireEvent.click(screen.getByTestId("crop-save"));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("cancel never writes, reset restores 50/50/1 in the draft", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const onCancel = vi.fn();
    wrap(
      <ThumbnailCropDialog
        open
        previewUrl="https://cdn.test/a.webp"
        value={{ thumbnail_x: 10, thumbnail_y: 90, thumbnail_zoom: 2 }}
        onCancel={onCancel}
        onSave={onSave}
      />,
    );
    fireEvent.click(screen.getByTestId("crop-reset"));
    const img = screen.getByTestId("crop-preview-img");
    await waitFor(() => expect(img.style.objectPosition).toBe("50% 50%"));
    expect(img.style.transform).toBe("");
    fireEvent.click(screen.getByTestId("crop-cancel"));
    expect(onSave).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });

  it("explains why a video without a cover cannot be adjusted", () => {
    wrap(<ThumbnailCropDialog open previewUrl="" value={{}} onCancel={() => {}} onSave={async () => true} />);
    expect(screen.getByText(CROP_COPY.noPoster.es)).toBeTruthy();
    expect(screen.queryByTestId("crop-save")).toBeNull();
  });

  it("has a localized label in ES/EN/RU", () => {
    expect(new Set(Object.values(CROP_COPY.adjust)).size).toBeGreaterThan(1);
    expect(CROP_COPY.adjust.en).toBe("Adjust thumbnail");
    expect(CROP_COPY.adjust.es).toBe("Ajustar miniatura");
    expect(CROP_COPY.adjust.ru).toBe("Настроить миниатюру");
  });
});

describe("lightbox", () => {
  it("shows the original with object-contain, no crop, and Montserrat text", () => {
    wrap(
      <GalleryLightbox items={[item({ thumbnail_x: 10, thumbnail_zoom: 2 })]} index={0} onClose={() => {}} onNavigate={() => {}} />,
    );
    const img = document.body.querySelector("img") as HTMLImageElement;
    expect(img.className).toContain("object-contain");
    expect(img.style.transform).toBe("");
    expect(img.style.objectPosition).toBe("");
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("font-body");
    expect(screen.getByRole("heading", { level: 2 }).className).toContain("font-body");
  });
});
