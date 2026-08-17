/**
 * uploadResumable lifecycle: a cancel must win over every late tus callback, and cleanup
 * must report honestly whether the orphan object is really gone.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const started = vi.fn();
const aborted = vi.fn();
/** Resolves findPreviousUploads() only when the test says so. */
let releasePrevious: (() => void) | null = null;

vi.mock("tus-js-client", () => ({
  Upload: class {
    constructor(public file: Blob, public opts: Record<string, unknown>) {}
    start = () => started();
    abort = async () => { aborted(); };
    resumeFromPreviousUpload = () => undefined;
    findPreviousUploads = () =>
      new Promise<unknown[]>((resolve) => { releasePrevious = () => resolve([]); });
  },
}));

const remove = vi.fn(async (_names: string[]) => ({ error: null as { message: string } | null }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: "t" } } }),
      getUser: async () => ({ data: { user: { id: "u" } } }),
    },
    storage: { from: () => ({ remove: (n: string[]) => remove(n) }) },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  releasePrevious = null;
  remove.mockResolvedValue({ error: null });
});

describe("uploadResumable cancellation", () => {
  it("never starts the transfer when findPreviousUploads resolves after the abort", async () => {
    const { uploadResumable } = await import("@/lib/video-upload");
    const controller = new AbortController();
    const promise = uploadResumable("staged-u-1.mp4", new Blob(["x"]), "video/mp4", {
      signal: controller.signal,
    });
    // The lookup is still pending — this is the window the guard protects.
    await vi.waitFor(() => expect(releasePrevious).toBeTypeOf("function"));
    controller.abort();
    releasePrevious!();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(aborted).toHaveBeenCalled();
    expect(started).not.toHaveBeenCalled();
    // The partial object is cleaned up, and only once.
    await vi.waitFor(() => expect(remove).toHaveBeenCalledWith(["staged-u-1.mp4"]));
  });

  it("rejects an already-aborted upload without starting it", async () => {
    const { uploadResumable } = await import("@/lib/video-upload");
    const controller = new AbortController();
    controller.abort();
    await expect(
      uploadResumable("staged-u-2.mp4", new Blob(["x"]), "video/mp4", { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(started).not.toHaveBeenCalled();
  });

  it("starts the transfer normally when nothing cancels it", async () => {
    const { uploadResumable } = await import("@/lib/video-upload");
    const promise = uploadResumable("staged-u-3.mp4", new Blob(["x"]), "video/mp4", {});
    await vi.waitFor(() => expect(releasePrevious).toBeTypeOf("function"));
    releasePrevious!();
    await vi.waitFor(() => expect(started).toHaveBeenCalled());
    void promise.catch(() => undefined);
  });
});

describe("removeObject reports the truth", () => {
  it("returns false when storage refuses the delete", async () => {
    const { removeObject } = await import("@/lib/video-upload");
    remove.mockResolvedValueOnce({ error: { message: "denied" } });
    expect(await removeObject("staged-u-4.mp4")).toBe(false);
    expect(await removeObject("staged-u-4.mp4")).toBe(true);
  });
});
