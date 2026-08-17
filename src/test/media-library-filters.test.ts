import { describe, it, expect } from "vitest";
import {
  collisionSafeName,
  countByKind,
  kindOf,
  sanitizeFileName,
} from "@/lib/media-kind";
import {
  applyFilters,
  availableExtensions,
  DEFAULT_FILTERS,
  isDefaultFilters,
  type LibraryFile,
} from "@/lib/media-filters";

const f = (over: Partial<LibraryFile>): LibraryFile => ({
  name: "a.jpg",
  size: 1024,
  url: "https://x/a.jpg",
  created_at: "2026-01-10T00:00:00Z",
  mimeType: "image/jpeg",
  ...over,
});

describe("media kind detection", () => {
  it("trusts the storage MIME over the extension", () => {
    expect(kindOf({ name: "clip.jpg", mimeType: "video/mp4" })).toBe("video");
    expect(kindOf({ name: "photo.mp4", mimeType: "image/png" })).toBe("photo");
  });

  it("falls back to the extension when the MIME is missing or generic", () => {
    expect(kindOf({ name: "clip.mov", mimeType: "" })).toBe("video");
    expect(kindOf({ name: "clip.webm", mimeType: "application/octet-stream" })).toBe("video");
    expect(kindOf({ name: "pic.webp", mimeType: null })).toBe("photo");
  });

  it("never guesses unknown files into a media category", () => {
    expect(kindOf({ name: "notes.pdf", mimeType: "application/pdf" })).toBe("other");
    expect(kindOf({ name: "archive.zip" })).toBe("other");
  });

  it("counts each category", () => {
    const counted = countByKind([
      f({ name: "a.jpg" }),
      f({ name: "b.mp4", mimeType: "video/mp4" }),
      f({ name: "c.pdf", mimeType: "application/pdf" }),
      f({ name: "d.mov", mimeType: null }),
    ]);
    expect(counted).toEqual({ photo: 1, video: 2, other: 1 });
  });
});

describe("file name safety", () => {
  it("strips paths, accents and unsafe characters", () => {
    // The extension is normalized to lower case so kind/format checks stay predictable.
    expect(sanitizeFileName("../../évil name (1).MP4")).toBe("evil-name-1.mp4");
    expect(sanitizeFileName("a/b/c.png")).toBe("a-b-c.png");
  });

  it("never produces a colliding name", () => {
    const first = collisionSafeName("clip.mp4", [], 111);
    const second = collisionSafeName("clip.mp4", [first], 111);
    expect(first).toBe("111-clip.mp4");
    expect(second).not.toBe(first);
  });
});

describe("library filters", () => {
  const files = [
    f({ name: "hero.jpg", size: 2 * 1024 * 1024, created_at: "2026-01-01T10:00:00Z" }),
    f({ name: "clip.mp4", mimeType: "video/mp4", size: 40 * 1024 * 1024, created_at: "2026-02-01T10:00:00Z" }),
    f({ name: "logo.svg", mimeType: "image/svg+xml", size: 4 * 1024, created_at: "2026-03-01T10:00:00Z" }),
    f({ name: "manual.pdf", mimeType: "application/pdf", size: 900 * 1024, created_at: "2026-04-01T10:00:00Z" }),
  ];
  const ctx = { usage: null, optimization: {} };

  it("defaults show everything, newest first", () => {
    const out = applyFilters(files, DEFAULT_FILTERS, ctx);
    expect(out.map((x) => x.name)).toEqual(["manual.pdf", "logo.svg", "clip.mp4", "hero.jpg"]);
    expect(isDefaultFilters(DEFAULT_FILTERS)).toBe(true);
  });

  it("filters by kind, extension, size, date and search", () => {
    expect(applyFilters(files, { ...DEFAULT_FILTERS, kind: "video" }, ctx).map((x) => x.name)).toEqual(["clip.mp4"]);
    expect(applyFilters(files, { ...DEFAULT_FILTERS, exts: ["svg", "pdf"] }, ctx)).toHaveLength(2);
    expect(applyFilters(files, { ...DEFAULT_FILTERS, minMB: "1" }, ctx).map((x) => x.name)).toEqual(["clip.mp4", "hero.jpg"]);
    expect(applyFilters(files, { ...DEFAULT_FILTERS, maxMB: "1" }, ctx).map((x) => x.name)).toEqual(["manual.pdf", "logo.svg"]);
    expect(applyFilters(files, { ...DEFAULT_FILTERS, from: "2026-03-01" }, ctx)).toHaveLength(2);
    expect(applyFilters(files, { ...DEFAULT_FILTERS, to: "2026-01-31" }, ctx).map((x) => x.name)).toEqual(["hero.jpg"]);
    expect(applyFilters(files, { ...DEFAULT_FILTERS, q: "CLI" }, ctx).map((x) => x.name)).toEqual(["clip.mp4"]);
  });

  it("treats un-scanned files as unknown usage, never as unused", () => {
    expect(applyFilters(files, { ...DEFAULT_FILTERS, usage: "unused" }, ctx)).toHaveLength(0);
    expect(applyFilters(files, { ...DEFAULT_FILTERS, usage: "unknown" }, ctx)).toHaveLength(4);
    const scanned = { usage: { "hero.jpg": 2, "clip.mp4": 0 }, optimization: {} };
    expect(applyFilters(files, { ...DEFAULT_FILTERS, usage: "used" }, scanned).map((x) => x.name)).toEqual(["hero.jpg"]);
    expect(applyFilters(files, { ...DEFAULT_FILTERS, usage: "unused" }, scanned).map((x) => x.name)).toEqual(["clip.mp4"]);
    expect(applyFilters(files, { ...DEFAULT_FILTERS, usage: "unknown" }, scanned)).toHaveLength(2);
  });

  it("sorts by name and size", () => {
    expect(applyFilters(files, { ...DEFAULT_FILTERS, sort: "sizeDesc" }, ctx)[0].name).toBe("clip.mp4");
    expect(applyFilters(files, { ...DEFAULT_FILTERS, sort: "sizeAsc" }, ctx)[0].name).toBe("logo.svg");
    expect(applyFilters(files, { ...DEFAULT_FILTERS, sort: "nameAsc" }, ctx)[0].name).toBe("clip.mp4");
    expect(applyFilters(files, { ...DEFAULT_FILTERS, sort: "nameDesc" }, ctx)[0].name).toBe("manual.pdf");
  });

  it("lists the distinct extensions present", () => {
    expect(availableExtensions(files)).toEqual(["jpg", "mp4", "pdf", "svg"]);
  });
});
