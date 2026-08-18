/**
 * Pure photo policy: no canvas, no DOM. These rules decide what the Library is allowed to
 * produce, so they must hold independently of the browser that runs the encoder.
 */
import { describe, it, expect } from "vitest";
import {
  DEFAULT_BACKGROUND, DEFAULT_QUALITY, FORMAT_BY_MIME, MAX_QUALITY, MIN_QUALITY,
  PHOTO_EXT, PHOTO_MIME, availablePhotoFormats, clampQuality, evaluatePhotoSaving,
  isLossless, mayHaveAlpha, photoOutputName, photoTargetDimensions, smartPhotoPreset,
  supportsAlpha, supportsQuality, willFlattenAlpha,
} from "@/lib/photo-encode";

const CAPS_ALL = { webp: true, jpg: true, png: true };

describe("quality policy", () => {
  it("clamps to the 40–100 window and rounds", () => {
    expect(MIN_QUALITY).toBe(40);
    expect(MAX_QUALITY).toBe(100);
    expect(clampQuality(10)).toBe(40);
    expect(clampQuality(40)).toBe(40);
    expect(clampQuality(82.4)).toBe(82);
    expect(clampQuality(100)).toBe(100);
    expect(clampQuality(1000)).toBe(100);
    expect(clampQuality(-5)).toBe(40);
  });

  it("falls back to the default for junk input", () => {
    expect(clampQuality("abc")).toBe(DEFAULT_QUALITY);
    expect(clampQuality(NaN)).toBe(DEFAULT_QUALITY);
    expect(clampQuality(undefined)).toBe(DEFAULT_QUALITY);
  });

  it("PNG is lossless: no quality slider, alpha kept", () => {
    expect(supportsQuality("png")).toBe(false);
    expect(isLossless("png")).toBe(true);
    expect(supportsAlpha("png")).toBe(true);
    expect(supportsQuality("jpg")).toBe(true);
    expect(supportsQuality("webp")).toBe(true);
  });
});

describe("format ↔ MIME ↔ extension mapping", () => {
  it("maps every supported format both ways", () => {
    expect(PHOTO_MIME).toEqual({ jpg: "image/jpeg", png: "image/png", webp: "image/webp" });
    expect(PHOTO_EXT).toEqual({ jpg: "jpg", png: "png", webp: "webp" });
    expect(FORMAT_BY_MIME["image/jpeg"]).toBe("jpg");
    expect(FORMAT_BY_MIME["image/png"]).toBe("png");
    expect(FORMAT_BY_MIME["image/webp"]).toBe("webp");
  });

  it("names the output with the target extension, never a double extension", () => {
    expect(photoOutputName("hero.jpg", "webp")).toBe("hero.webp");
    expect(photoOutputName("hero.PNG", "jpg")).toBe("hero.jpg");
    expect(photoOutputName("no-extension", "png")).toBe("no-extension.png");
  });

  it("lists only what the browser can encode", () => {
    expect(availablePhotoFormats(CAPS_ALL)).toEqual(["webp", "jpg", "png"]);
    expect(availablePhotoFormats({ webp: false, jpg: true, png: true })).toEqual(["jpg", "png"]);
  });
});

describe("dimension policy", () => {
  it("never upscales", () => {
    expect(photoTargetDimensions(900, 600, "1920")).toEqual({ width: 900, height: 600 });
    expect(photoTargetDimensions(900, 600, "custom", 4000)).toEqual({ width: 900, height: 600 });
  });

  it("caps the longest edge and keeps the aspect ratio", () => {
    expect(photoTargetDimensions(4000, 2000, "1920")).toEqual({ width: 1920, height: 960 });
    expect(photoTargetDimensions(2000, 4000, "1280")).toEqual({ width: 640, height: 1280 });
  });

  it("keeps the source size for 'original' and sanitizes custom values", () => {
    expect(photoTargetDimensions(3000, 1500, "original")).toEqual({ width: 3000, height: 1500 });
    expect(photoTargetDimensions(3000, 1500, "custom", 10)).toEqual({ width: 64, height: 32 });
    expect(photoTargetDimensions(3000, 1500, "custom", 99999)).toEqual({ width: 3000, height: 1500 });
  });
});

describe("JPEG alpha and background policy", () => {
  it("knows which sources can carry transparency", () => {
    expect(mayHaveAlpha("image/png", "logo.png")).toBe(true);
    expect(mayHaveAlpha("image/webp", "logo.webp")).toBe(true);
    expect(mayHaveAlpha("image/jpeg", "photo.jpg")).toBe(false);
    expect(mayHaveAlpha("", "logo.png")).toBe(true);
  });

  it("warns only when transparency would actually be flattened", () => {
    const source = { width: 100, height: 100, mime: "image/png", hasAlpha: true };
    const base = { quality: 82, size: "original" as const, customSize: 1920, background: DEFAULT_BACKGROUND };
    expect(willFlattenAlpha({ ...base, format: "jpg" }, source)).toBe(true);
    expect(willFlattenAlpha({ ...base, format: "png" }, source)).toBe(false);
    expect(willFlattenAlpha({ ...base, format: "webp" }, source)).toBe(false);
    expect(willFlattenAlpha({ ...base, format: "jpg" }, { ...source, hasAlpha: false })).toBe(false);
  });

  it("defaults the flatten colour to white", () => {
    expect(DEFAULT_BACKGROUND).toBe("#ffffff");
    expect(smartPhotoPreset({ width: 100, height: 100, mime: "image/png", hasAlpha: true }, CAPS_ALL).background)
      .toBe("#ffffff");
  });

  it("smart preset keeps alpha when it can and caps big photos at 1920", () => {
    const transparent = { width: 3000, height: 3000, mime: "image/png", hasAlpha: true };
    expect(smartPhotoPreset(transparent, CAPS_ALL)).toMatchObject({ format: "webp", size: "1920" });
    // No WebP encoder: transparency must fall back to PNG, not JPEG.
    expect(smartPhotoPreset(transparent, { webp: false, jpg: true, png: true }).format).toBe("png");
    expect(smartPhotoPreset({ width: 800, height: 600, mime: "image/jpeg", hasAlpha: false }, { webp: false, jpg: true, png: true }))
      .toMatchObject({ format: "jpg", size: "original" });
  });
});

describe("saving verdict", () => {
  it("requires 10% or 10 KB before a replacement counts as a win", () => {
    expect(evaluatePhotoSaving(1_000_000, 500_000).ok).toBe(true);
    expect(evaluatePhotoSaving(1_000_000, 999_000).ok).toBe(false);
    expect(evaluatePhotoSaving(1_000_000, 1_200_000)).toMatchObject({ ok: false });
    expect(evaluatePhotoSaving(1_000_000, 1_200_000).savedBytes).toBeLessThan(0);
  });
});
