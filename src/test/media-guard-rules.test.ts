import { describe, it, expect } from "vitest";
import {
  evaluateSaving,
  magicMatches,
  MAX_UPLOAD_BYTES,
  validateName,
  validateOutputType,
  validateRenameExtension,
  MIN_SAVING_BYTES,
} from "../../supabase/functions/media-guard/rules";

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(20).fill(0)]);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0]);

describe("media-guard server rules — rename", () => {
  it("rejects an extension change on rename (format changes go through compression)", () => {
    expect(validateRenameExtension("hero.jpg", "hero.webp")).toMatch(/Keep the \.jpg extension/);
  });

  it("accepts a basename-only rename, case-insensitively on the extension", () => {
    expect(validateRenameExtension("hero.JPG", "masaje-valencia.jpg")).toBeNull();
  });

  it("rejects paths, traversal and empty names", () => {
    expect(validateName("")).toBe("Name cannot be empty");
    expect(validateName("../evil.jpg")).toBe("Name cannot contain paths");
    expect(validateName("a/b.jpg")).toBe("Name cannot contain paths");
    expect(validateName("no-extension")).toBeTruthy();
    expect(validateName("ok_file-1.webp")).toBeNull();
  });
});

describe("media-guard server rules — replace", () => {
  it("rejects a MIME/extension mismatch", () => {
    expect(validateOutputType("image/webp", "hero.png")).toMatch(/does not match image\/webp/);
    expect(validateOutputType("image/jpeg", "hero.jpeg")).toBeNull();
    expect(validateOutputType("image/png", "hero.png")).toBeNull();
  });

  it("rejects formats that must never be re-encoded", () => {
    expect(validateOutputType("image/gif", "a.gif")).toBe("Unsupported output format");
    expect(validateOutputType("image/svg+xml", "a.svg")).toBe("Unsupported output format");
    expect(validateOutputType("image/avif", "a.avif")).toBe("Unsupported output format");
  });

  it("rejects forged content types via magic bytes", () => {
    expect(magicMatches("image/webp", WEBP)).toBe(true);
    expect(magicMatches("image/png", PNG)).toBe(true);
    expect(magicMatches("image/jpeg", JPEG)).toBe(true);
    // A PNG payload declared as WebP must not pass
    expect(magicMatches("image/webp", PNG)).toBe(false);
    // An SVG/text payload declared as PNG must not pass
    expect(magicMatches("image/png", new TextEncoder().encode("<svg xmlns=…></svg>"))).toBe(false);
  });

  it("uses the ACTUAL stored size for the threshold, so a forged originalSize cannot help", () => {
    // Client claims the original was 1 MB, reality is 100 KB and the candidate is 99 KB.
    const actual = 100 * 1024;
    const verdict = evaluateSaving(actual, 99 * 1024);
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.alreadyCompressed).toBe(true);
  });

  it("requires at least 10% AND 10 KB of saving", () => {
    // 50% saving but only 5 KB in absolute terms → rejected
    expect(evaluateSaving(10 * 1024, 5 * 1024).ok).toBe(false);
    // 200 KB saving but only 5% of a 4 MB file → rejected
    expect(evaluateSaving(4 * 1024 * 1024, 4 * 1024 * 1024 - 200 * 1024).ok).toBe(false);
    // 20% and 200 KB → accepted
    expect(evaluateSaving(1024 * 1024, 1024 * 1024 - 210 * 1024).ok).toBe(true);
    // exactly at the boundary of both rules
    expect(evaluateSaving(100 * 1024, 100 * 1024 - MIN_SAVING_BYTES).ok).toBe(true);
  });

  it("refuses a result that is not smaller at all", () => {
    const verdict = evaluateSaving(1000, 1200);
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.alreadyCompressed).toBe(false);
    expect(verdict.ok === false && verdict.message).toMatch(/not smaller/);
  });

  it("keeps a sane payload ceiling", () => {
    expect(MAX_UPLOAD_BYTES).toBe(15 * 1024 * 1024);
  });
});
