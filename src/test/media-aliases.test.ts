import { describe, it, expect } from "vitest";
import {
  buildAliasMap,
  resolveMediaName,
  resolveMediaInText,
  resolveSnapshotMedia,
} from "@/lib/media-aliases";

const CDN = "https://cdn.test/storage/v1/object/public/media";

describe("media alias resolution (history restore safety)", () => {
  it("resolves a single rename", () => {
    const map = buildAliasMap([{ old_name: "a.jpg", new_name: "b.jpg" }]);
    expect(resolveMediaName("a.jpg", map)).toBe("b.jpg");
    expect(resolveMediaName("untouched.jpg", map)).toBe("untouched.jpg");
  });

  it("follows a chain A→B→C produced by consecutive renames", () => {
    const map = buildAliasMap([
      { old_name: "a.jpg", new_name: "b.jpg" },
      { old_name: "b.jpg", new_name: "c.webp" },
    ]);
    expect(resolveMediaName("a.jpg", map)).toBe("c.webp");
    expect(resolveMediaName("b.jpg", map)).toBe("c.webp");
  });

  it("is cycle-safe", () => {
    const map = buildAliasMap([
      { old_name: "a.jpg", new_name: "b.jpg" },
      { old_name: "b.jpg", new_name: "a.jpg" },
    ]);
    expect(["a.jpg", "b.jpg"]).toContain(resolveMediaName("a.jpg", map));
  });

  it("rewrites raw filenames, full public URLs and URL-encoded names", () => {
    const map = buildAliasMap([
      { old_name: "foto vieja.jpg", new_name: "foto media.jpg" },
      { old_name: "foto media.jpg", new_name: "foto-final.webp" },
    ]);
    expect(resolveMediaInText("foto vieja.jpg", map)).toBe("foto-final.webp");
    expect(resolveMediaInText(`${CDN}/foto vieja.jpg`, map)).toBe(`${CDN}/foto-final.webp`);
    expect(resolveMediaInText(`${CDN}/${encodeURIComponent("foto vieja.jpg")}`, map)).toBe(
      `${CDN}/${encodeURIComponent("foto-final.webp")}`,
    );
  });

  it("remaps every string field of a snapshot without touching the rest", () => {
    const map = buildAliasMap([{ old_name: "hero.jpg", new_name: "hero.webp" }]);
    const snapshot = {
      id: "1",
      title: "Masaje",
      content: `<img src="${CDN}/hero.jpg" alt="x">`,
      content_en: `see ${encodeURIComponent("hero.jpg")}`,
      sort_order: 3,
      hidden: false,
    };
    const { snapshot: out, remapped } = resolveSnapshotMedia(snapshot, map);
    expect(remapped).toBe(2);
    expect(out.content).toContain("hero.webp");
    expect(out.content).not.toContain("hero.jpg");
    expect(out.content_en).toBe(`see ${encodeURIComponent("hero.webp")}`);
    expect(out.sort_order).toBe(3);
    expect(out.hidden).toBe(false);
    expect(out.title).toBe("Masaje");
  });

  it("returns the snapshot untouched when there are no aliases", () => {
    const snapshot = { content: `${CDN}/hero.jpg` };
    const { snapshot: out, remapped } = resolveSnapshotMedia(snapshot, new Map());
    expect(remapped).toBe(0);
    expect(out.content).toBe(`${CDN}/hero.jpg`);
  });
});
