import { describe, it, expect, beforeEach } from "vitest";
import {
  FILTERS_STORAGE_KEY, clearFilters, loadFilters, parseFilters, saveFilters,
} from "@/lib/media-filters-storage";
import { DEFAULT_FILTERS, isDefaultFilters } from "@/lib/media-filters";

beforeEach(() => localStorage.clear());

describe("library filter persistence", () => {
  it("round-trips every filter field plus the panel state", () => {
    const filters = {
      ...DEFAULT_FILTERS,
      q: "hero", kind: "video" as const, exts: ["mp4", "webp"],
      minMB: "1.5", maxMB: "40", from: "2026-01-01", to: "2026-02-01",
      usage: "used" as const, opt: "optimized" as const, sort: "sizeDesc" as const,
    };
    saveFilters(filters, true);
    expect(loadFilters()).toEqual({ filters, open: true });
  });

  it("falls back to defaults for corrupted, old or unknown payloads", () => {
    expect(parseFilters(null).filters).toEqual(DEFAULT_FILTERS);
    expect(parseFilters("{not json").filters).toEqual(DEFAULT_FILTERS);
    expect(parseFilters(JSON.stringify({ v: 0, filters: { kind: "video" } })).filters).toEqual(DEFAULT_FILTERS);
    expect(parseFilters(JSON.stringify({ v: 1, filters: null })).filters).toEqual(DEFAULT_FILTERS);
  });

  it("rejects out-of-allowlist and wrongly typed values field by field", () => {
    const { filters } = parseFilters(JSON.stringify({
      v: 1,
      filters: {
        q: 42, kind: "spreadsheet", exts: ["mp4", 7, "../etc"], minMB: "abc", maxMB: "2",
        from: "01/01/2026", to: "2026-02-01", usage: "maybe", opt: "<script>", sort: "random",
      },
      open: "yes",
    }));
    expect(filters).toEqual({
      ...DEFAULT_FILTERS, exts: ["mp4"], maxMB: "2", to: "2026-02-01",
    });
    expect(parseFilters(JSON.stringify({ v: 1, open: "yes" })).open).toBe(false);
  });

  it("does not write a key for the fully default, closed state", () => {
    saveFilters({ ...DEFAULT_FILTERS, kind: "photo" }, false);
    saveFilters(DEFAULT_FILTERS, false);
    expect(localStorage.getItem(FILTERS_STORAGE_KEY)).toBeNull();
    // An open panel is still a meaningful state worth remembering.
    saveFilters(DEFAULT_FILTERS, true);
    expect(loadFilters()).toEqual({ filters: DEFAULT_FILTERS, open: true });
  });

  it("clears the persisted key on a manual reset", () => {
    saveFilters({ ...DEFAULT_FILTERS, kind: "photo" }, true);
    clearFilters();
    expect(localStorage.getItem(FILTERS_STORAGE_KEY)).toBeNull();
    expect(loadFilters()).toEqual({ filters: DEFAULT_FILTERS, open: false });
  });

  it("counts kind as part of the default state", () => {
    expect(isDefaultFilters(DEFAULT_FILTERS)).toBe(true);
    expect(isDefaultFilters({ ...DEFAULT_FILTERS, kind: "video" })).toBe(false);
  });
});
