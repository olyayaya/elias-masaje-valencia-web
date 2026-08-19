import { describe, it, expect } from "vitest";
import { filterAndSortGallery, filterGallery, sortGallery } from "@/lib/gallery-view";
import type { GalleryItem } from "@/lib/gallery";

const make = (
  id: string,
  media_type: "photo" | "video",
  sort_order: number,
  created_at: string,
  view_count = 0,
): GalleryItem =>
  ({
    id,
    media_type,
    media_url: `https://cdn.test/${id}`,
    poster_url: "",
    title_es: "", title_en: "", title_ru: "",
    description_es: "", description_en: "", description_ru: "",
    alt_es: "", alt_en: "", alt_ru: "",
    sort_order,
    published: true,
    duration_seconds: null,
    thumbnail_x: 50, thumbnail_y: 50, thumbnail_zoom: 1,
    created_at,
    updated_at: created_at,
    view_count,
    like_count: 0,
  }) as GalleryItem;

const items: GalleryItem[] = [
  make("p1", "photo", 2, "2026-01-02T00:00:00Z", 10),
  make("v1", "video", 1, "2026-01-03T00:00:00Z", 50),
  make("p2", "photo", 3, "2026-01-01T00:00:00Z", 50),
];

describe("public gallery filter + sort", () => {
  it("filters by media type", () => {
    expect(filterGallery(items, "all")).toHaveLength(3);
    expect(filterGallery(items, "photo").map((i) => i.id)).toEqual(["p1", "p2"]);
    expect(filterGallery(items, "video").map((i) => i.id)).toEqual(["v1"]);
  });

  it("defaults to the manual dashboard order", () => {
    expect(sortGallery(items, "manual").map((i) => i.id)).toEqual(["v1", "p1", "p2"]);
  });

  it("sorts newest and oldest by created_at", () => {
    expect(sortGallery(items, "newest").map((i) => i.id)).toEqual(["v1", "p1", "p2"]);
    expect(sortGallery(items, "oldest").map((i) => i.id)).toEqual(["p2", "p1", "v1"]);
  });

  it("sorts most viewed, breaking ties with the manual order", () => {
    expect(sortGallery(items, "popular").map((i) => i.id)).toEqual(["v1", "p2", "p1"]);
  });

  it("treats missing counters as zero instead of throwing", () => {
    const noCounters = items.map(({ view_count: _v, like_count: _l, ...rest }) => rest as GalleryItem);
    expect(sortGallery(noCounters, "popular").map((i) => i.id)).toEqual(["v1", "p1", "p2"]);
  });

  it("combines filter and sort", () => {
    expect(filterAndSortGallery(items, "photo", "oldest").map((i) => i.id)).toEqual(["p2", "p1"]);
  });

  it("never mutates the input list", () => {
    const source = items.slice();
    sortGallery(source, "oldest");
    expect(source.map((i) => i.id)).toEqual(["p1", "v1", "p2"]);
  });
});
