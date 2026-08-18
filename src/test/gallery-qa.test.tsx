/* @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@/i18n/context";
import { ThemeProvider } from "@/contexts/ThemeContext";
import {
  buildGallerySchema,
  canPublish,
  isWebPlayableVideo,
  publishIssues,
  storageThumbUrl,
  thumbnailFor,
  type GalleryItem,
} from "@/lib/gallery";
import { posterNameFor } from "@/lib/gallery-poster";

const SUPA = "https://ukjljyrejfkyurebksqz.supabase.co";

const base: GalleryItem = {
  id: "x",
  media_type: "photo",
  media_url: `${SUPA}/storage/v1/object/public/media/sala.webp`,
  poster_url: "",
  title_es: "Sala", title_en: "", title_ru: "",
  description_es: "", description_en: "", description_ru: "",
  alt_es: "Sala", alt_en: "", alt_ru: "",
  sort_order: 1, published: false, duration_seconds: null,
  thumbnail_x: 50, thumbnail_y: 50, thumbnail_zoom: 1,
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
};

const video = (over: Partial<GalleryItem> = {}): GalleryItem => ({
  ...base,
  id: "v",
  media_type: "video",
  media_url: `${SUPA}/storage/v1/object/public/media/clip.mp4`,
  poster_url: `${SUPA}/storage/v1/object/public/media/clip-cover.webp`,
  ...over,
});

afterEach(cleanup);

describe("storage thumbnails", () => {
  it("rewrites a public media image to a bounded render/image derivative", () => {
    const url = storageThumbUrl(base.media_url)!;
    expect(url).toContain("/storage/v1/render/image/public/media/sala.webp");
    expect(url).toContain("width=800");
    expect(url).toContain("quality=70");
    expect(url).toContain("resize=cover");
  });

  it("clamps caller-supplied bounds", () => {
    const url = storageThumbUrl(base.media_url, { width: 99999, quality: 1 })!;
    expect(url).toContain("width=1600");
    expect(url).toContain("quality=20");
  });

  it("leaves non-transformable and foreign URLs untouched", () => {
    expect(storageThumbUrl(`${SUPA}/storage/v1/object/public/media/logo.svg`)).toBeNull();
    expect(storageThumbUrl(`${SUPA}/storage/v1/object/public/other/x.webp`)).toBeNull();
    expect(storageThumbUrl("https://cdn.test/photo.webp")).toBeNull();
    expect(storageThumbUrl("not a url")).toBeNull();
  });

  it("uses the derivative for the grid and the poster for videos", () => {
    expect(thumbnailFor(base)).toContain("/render/image/public/media/sala.webp");
    expect(thumbnailFor(video())).toContain("/render/image/public/media/clip-cover.webp");
    expect(thumbnailFor({ ...video(), poster_url: "" })).toBe("");
  });
});

describe("publish rules", () => {
  it("accepts a photo with media", () => {
    expect(publishIssues(base)).toEqual([]);
    expect(canPublish(base)).toBe(true);
  });

  it("blocks a video without a cover", () => {
    expect(publishIssues(video({ poster_url: "" }))).toContain("missingPoster");
  });

  it("blocks MOV/M4V videos that browsers cannot play inline", () => {
    const mov = video({ media_url: `${SUPA}/storage/v1/object/public/media/clip.mov` });
    expect(publishIssues(mov)).toContain("notWebPlayable");
    expect(isWebPlayableVideo("a/b/c.mp4")).toBe(true);
    expect(isWebPlayableVideo("a/b/c.webm")).toBe(true);
    expect(isWebPlayableVideo("a/b/c.m4v")).toBe(false);
  });

  it("blocks an item with no media at all", () => {
    expect(publishIssues({ ...base, media_url: "  " })).toContain("missingMedia");
  });
});

describe("video SEO honesty", () => {
  it("omits a VideoObject that has no cover image", () => {
    const schema = buildGallerySchema([video({ poster_url: "" })], "es");
    expect(schema.hasPart).toHaveLength(0);
  });

  it("emits a complete VideoObject when the cover exists", () => {
    const schema = buildGallerySchema([video({ duration_seconds: 30 })], "es");
    const v = schema.hasPart[0] as Record<string, unknown>;
    expect(v["@type"]).toBe("VideoObject");
    expect(v.name).toBeTruthy();
    expect(v.contentUrl).toContain("clip.mp4");
    expect(v.thumbnailUrl).toBeTruthy();
    expect(v.uploadDate).toBe("2026-01-01T00:00:00Z");
    expect(v.duration).toBe("PT30S");
  });
});

describe("poster naming", () => {
  it("derives a collision-safe cover name from the video", () => {
    // The upload timestamp prefix of the source is stripped, the storage-safe
    // prefix is re-applied, and an existing name is never overwritten.
    expect(posterNameFor("https://cdn.test/1750000000000-clip.mp4", "webp", [], 111)).toBe("111-clip-cover.webp");
    expect(posterNameFor("https://cdn.test/clip.mp4", "webp", ["111-clip-cover.webp"], 111)).toBe(
      "111-1-clip-cover.webp",
    );
  });
});

/* ------------------------------------------------------------------ */

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ select: () => ({ order: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) }),
    storage: { from: () => ({ list: () => Promise.resolve({ data: [] }), getPublicUrl: () => ({ data: { publicUrl: "" } }) }) },
    rpc: () => Promise.resolve({ error: null }),
  },
}));

const missingTableState = { value: true };
vi.mock("@/hooks/use-gallery", () => ({
  useGallery: () => ({ data: [], isPending: false, missingTable: missingTableState.value }),
  useGalleryAdmin: () => ({ data: [], isPending: false, missingTable: missingTableState.value }),
}));

import DashboardGallery from "@/components/dashboard/DashboardGallery";
import GalleryLightbox from "@/components/gallery/GalleryLightbox";

const wrap = (ui: React.ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <ThemeProvider>
          <MemoryRouter>{ui}</MemoryRouter>
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>,
  );

describe("dashboard missing-table notice", () => {
  it("is reachable when the gallery table does not exist yet", () => {
    missingTableState.value = true;
    wrap(<DashboardGallery />);
    expect(screen.getByTestId("gallery-missing-table")).toBeTruthy();
  });

  it("is hidden once the table exists", () => {
    missingTableState.value = false;
    wrap(<DashboardGallery />);
    expect(screen.queryByTestId("gallery-missing-table")).toBeNull();
  });
});

describe("lightbox accessibility", () => {
  it("restores focus to the element that opened it", async () => {
    const items: GalleryItem[] = [base];

    const opener = document.createElement("button");
    opener.textContent = "open";
    document.body.appendChild(opener);
    opener.focus();
    expect(document.activeElement).toBe(opener);

    const { unmount } = wrap(
      <GalleryLightbox items={items} index={0} onClose={() => {}} onNavigate={() => {}} />,
    );
    await waitFor(() => expect(document.activeElement).not.toBe(opener));

    unmount();
    await waitFor(() => expect(document.activeElement).toBe(opener));
    opener.remove();
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    wrap(<GalleryLightbox items={[base]} index={0} onClose={onClose} onNavigate={() => {}} />);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
