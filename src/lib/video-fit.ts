/**
 * Intrinsic-aware sizing for video preview surfaces.
 *
 * A `<video className="w-full">` inside a dialog is stretched to the dialog width —
 * a 320×568 clip is upscaled to a blurry full-width block. These helpers compute the
 * CSS pixel box a clip should occupy: never larger than its own intrinsic size, and
 * never larger than the space actually left over by the header and the controls.
 */

export interface Size {
  width: number;
  height: number;
}

/** Space reserved around the video inside a full-screen viewer. */
export const VIEWER_MARGIN_X = 32;
export const VIEWER_CHROME_Y = 220;

/**
 * Largest box the clip may occupy: shrink-to-fit on both axes, never upscale.
 * Returns a zero box when the intrinsic size is not known yet (metadata pending).
 */
export function fitVideoSize(intrinsic: Size, available: Size): Size {
  const iw = Math.max(0, Math.floor(intrinsic.width || 0));
  const ih = Math.max(0, Math.floor(intrinsic.height || 0));
  if (!iw || !ih) return { width: 0, height: 0 };

  const aw = Math.max(0, Math.floor(available.width || 0));
  const ah = Math.max(0, Math.floor(available.height || 0));
  // No measurement yet → show the clip at its own size rather than stretching it.
  if (!aw || !ah) return { width: iw, height: ih };

  const scale = Math.min(1, aw / iw, ah / ih);
  return { width: Math.max(1, Math.round(iw * scale)), height: Math.max(1, Math.round(ih * scale)) };
}

/** Viewport minus safe margins and the viewer's own header / control strip. */
export function availableViewerBox(
  viewport: Size,
  opts: { marginX?: number; chromeY?: number } = {},
): Size {
  const marginX = opts.marginX ?? VIEWER_MARGIN_X;
  const chromeY = opts.chromeY ?? VIEWER_CHROME_Y;
  return {
    width: Math.max(120, Math.floor((viewport.width || 0) - marginX * 2)),
    height: Math.max(120, Math.floor((viewport.height || 0) - chromeY)),
  };
}

/** mm:ss (or h:mm:ss) for the time readout — never NaN. */
export function formatClock(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Keyboard seek step: fine on short clips, sensible on long ones. */
export const seekStep = (duration: number) => (duration > 300 ? 10 : 5);

/** Slider granularity: sub-second on short clips so frame picking stays precise. */
export const sliderStep = (duration: number) => (duration > 0 && duration <= 60 ? 0.05 : 0.1);
