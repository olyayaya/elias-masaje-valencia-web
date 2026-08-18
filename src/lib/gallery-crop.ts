import type { CSSProperties } from "react";

/**
 * Non-destructive thumbnail framing.
 *
 * The stored original is never modified: the 4/3 grid tile simply shows a
 * different part of the same file via `object-position` (focal point) plus an
 * optional CSS `scale` (zoom). 50 / 50 / 1 reproduces the historical
 * `object-cover` + centered behaviour exactly (no transform emitted at all).
 */
export interface GalleryCrop {
  thumbnail_x: number;
  thumbnail_y: number;
  thumbnail_zoom: number;
}

export const CROP_DEFAULTS: GalleryCrop = {
  thumbnail_x: 50,
  thumbnail_y: 50,
  thumbnail_zoom: 1,
};

export const CROP_LIMITS = {
  x: { min: 0, max: 100 },
  y: { min: 0, max: 100 },
  zoom: { min: 1, max: 3 },
} as const;

const num = (value: unknown, fallback: number, min: number, max: number) => {
  const n = typeof value === "string" ? Number(value) : (value as number);
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

/** Always returns finite values inside the allowed ranges (never NaN/Infinity). */
export function clampCrop(input: Partial<GalleryCrop> | null | undefined): GalleryCrop {
  return {
    thumbnail_x: num(input?.thumbnail_x, CROP_DEFAULTS.thumbnail_x, CROP_LIMITS.x.min, CROP_LIMITS.x.max),
    thumbnail_y: num(input?.thumbnail_y, CROP_DEFAULTS.thumbnail_y, CROP_LIMITS.y.min, CROP_LIMITS.y.max),
    thumbnail_zoom: num(
      input?.thumbnail_zoom,
      CROP_DEFAULTS.thumbnail_zoom,
      CROP_LIMITS.zoom.min,
      CROP_LIMITS.zoom.max,
    ),
  };
}

/** Rounded values ready to be written to the database. */
export function cropForSave(input: Partial<GalleryCrop>): GalleryCrop {
  const c = clampCrop(input);
  return {
    thumbnail_x: Math.round(c.thumbnail_x),
    thumbnail_y: Math.round(c.thumbnail_y),
    thumbnail_zoom: Math.round(c.thumbnail_zoom * 100) / 100,
  };
}

/**
 * Single source of truth for the framing — dashboard preview and the public grid
 * render the identical style, so what the admin sees is what visitors get.
 */
export function cropStyle(input: Partial<GalleryCrop> | null | undefined): CSSProperties {
  const { thumbnail_x: x, thumbnail_y: y, thumbnail_zoom: zoom } = clampCrop(input);
  const style: CSSProperties = {
    objectFit: "cover",
    objectPosition: `${x}% ${y}%`,
  };
  if (zoom > 1) {
    style.transform = `scale(${zoom})`;
    style.transformOrigin = `${x}% ${y}%`;
  }
  return style;
}
