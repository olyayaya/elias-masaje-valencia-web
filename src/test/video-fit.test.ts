import { describe, it, expect } from "vitest";
import {
  availableViewerBox,
  fitVideoSize,
  formatClock,
  seekStep,
  sliderStep,
} from "@/lib/video-fit";

describe("video fit", () => {
  it("never upscales a clip smaller than the available area", () => {
    expect(fitVideoSize({ width: 320, height: 568 }, { width: 1200, height: 900 })).toEqual({
      width: 320,
      height: 568,
    });
  });

  it("shrinks a large clip so it fits on both axes without cropping", () => {
    const fitted = fitVideoSize({ width: 3840, height: 2160 }, { width: 1000, height: 400 });
    expect(fitted.width).toBeLessThanOrEqual(1000);
    expect(fitted.height).toBeLessThanOrEqual(400);
    // Aspect ratio preserved.
    expect(fitted.width / fitted.height).toBeCloseTo(3840 / 2160, 1);
  });

  it("fits a tall portrait clip by height", () => {
    const fitted = fitVideoSize({ width: 1080, height: 1920 }, { width: 1200, height: 600 });
    expect(fitted.height).toBe(600);
    expect(fitted.width).toBeLessThan(1200);
  });

  it("returns a zero box until metadata is known", () => {
    expect(fitVideoSize({ width: 0, height: 0 }, { width: 800, height: 600 })).toEqual({
      width: 0,
      height: 0,
    });
  });

  it("reserves room for header and controls", () => {
    const box = availableViewerBox({ width: 1280, height: 800 }, { marginX: 32, chromeY: 260 });
    expect(box.width).toBe(1216);
    expect(box.height).toBe(540);
  });

  it("formats the clock without NaN", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(Number.NaN)).toBe("0:00");
    expect(formatClock(75)).toBe("1:15");
    expect(formatClock(3675)).toBe("1:01:15");
  });

  it("uses finer steps on short clips", () => {
    expect(sliderStep(10)).toBeLessThan(sliderStep(600));
    expect(seekStep(10)).toBeLessThan(seekStep(600));
  });
});
