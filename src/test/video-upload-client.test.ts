/**
 * Regression guard for "i.Upload is not a constructor".
 *
 * The real tus-js-client module is used here (NOT mocked): the bug was that the module
 * namespace reaching `new tus.Upload()` was not the namespace at all, so the only useful
 * test is one that exercises the real export shape through uploadResumable.
 */
import { describe, it, expect } from "vitest";

describe("tus-js-client module shape", () => {
  it("exposes Upload as a real constructor on the named export", async () => {
    const mod = await import("tus-js-client");
    expect(typeof mod.Upload).toBe("function");
    expect(typeof new mod.Upload(new Blob(["x"]), { endpoint: "http://x/" }).start).toBe("function");
  });
});

describe("uploadResumable constructs the real client", () => {
  it("reaches the abort path instead of throwing 'Upload is not a constructor'", async () => {
    const { uploadResumable } = await import("@/lib/video-upload");
    const controller = new AbortController();
    controller.abort();
    // The constructor runs BEFORE the aborted-signal check, so a broken import would
    // surface here as a TypeError rather than a clean AbortError.
    await expect(
      uploadResumable("staged-real-1.mp4", new Blob(["x"]), "video/mp4", { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
