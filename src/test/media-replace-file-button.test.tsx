/**
 * "Replace file" swaps the LOCAL source of an existing library object while keeping the
 * replace target. It exists only in replace mode and never uploads anything by itself.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const toastError = vi.fn();

vi.mock("sonner", () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock("@/lib/media-usage", () => ({
  replaceMediaFile: vi.fn(async () => ({ newName: "hero.webp" })),
  commitVideoReplacement: vi.fn(async () => ({ newName: "clip.mp4" })),
}));

vi.mock("@/lib/video-upload", () => ({
  uploadResumable: vi.fn(), stagedObjectName: vi.fn(async () => "staged/x.mp4"), removeObject: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: () => ({ upload: vi.fn(async () => ({ data: {}, error: null })) }) } },
}));

vi.mock("@/lib/photo-encode", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/photo-encode")>();
  return {
    ...actual,
    probePhotoCaps: () => ({ webp: true, jpg: true, png: true }),
    loadImageElement: vi.fn(async () => ({ naturalWidth: 2400, naturalHeight: 1200 }) as HTMLImageElement),
    encodePhoto: vi.fn(async () => ({
      blob: new Blob([new Uint8Array(1024)], { type: "image/webp" }),
      size: 1024, mime: "image/webp", format: "webp" as const, width: 1920, height: 960,
    })),
  };
});

import MediaProcessingDialog, { type ProcessingItem } from "@/components/dashboard/MediaProcessingDialog";
import { makeL } from "@/components/dashboard/media/i18n";

const L = makeL("en");
const photo = (name = "hero.webp", bytes = 400 * 1024, type = "image/webp") =>
  new File([new Uint8Array(bytes)], name, { type });
const video = (name = "clip.mp4", bytes = 1024) =>
  new File([new Uint8Array(bytes)], name, { type: "video/mp4" });

const replaceItem = (): ProcessingItem => ({
  id: "edit-hero", file: photo(), kind: "photo",
  replace: { name: "hero.webp", size: 400 * 1024, publishedInGallery: false },
});

const mount = (items: ProcessingItem[]) =>
  render(
    <MediaProcessingDialog items={items} L={L} existingNames={["hero.webp"]} onClose={vi.fn()} onApplied={vi.fn()} />,
  );

const input = () => document.querySelector('[data-testid="replace-file-input"]') as HTMLInputElement;
const sourceLine = () => screen.getByText(/File 1 of 1/);

beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
});

describe("Replace file button", () => {
  it("exists only when editing an existing object", async () => {
    mount([replaceItem()]);
    expect(await screen.findByRole("button", { name: /Replace file/ })).toBeInTheDocument();
  });

  it("is absent for a normal upload queue", async () => {
    mount([{ id: "up-1", file: photo("new.jpg", 1024, "image/jpeg"), kind: "photo" }]);
    await screen.findByText("Prepare media");
    expect(screen.queryByRole("button", { name: /Replace file/ })).not.toBeInTheDocument();
    expect(input()).toBeNull();
  });

  it("clicking the button opens the hidden file input", async () => {
    mount([replaceItem()]);
    await screen.findByRole("button", { name: /Replace file/ });
    const click = vi.spyOn(input(), "click");
    fireEvent.click(screen.getByRole("button", { name: /Replace file/ }));
    expect(click).toHaveBeenCalledTimes(1);
    expect(input().accept).toContain(".webp");
  });

  it("a valid photo becomes the new local source and keeps the replace target", async () => {
    mount([replaceItem()]);
    await screen.findByRole("button", { name: /Replace file/ });
    fireEvent.change(input(), { target: { files: [photo("fresh.png", 2048, "image/png")] } });

    await waitFor(() => expect(sourceLine().textContent).toContain("fresh.png"));
    // The dialog title still targets the original object.
    expect(screen.getByText(/Edit or replace hero\.webp/)).toBeInTheDocument();
    expect(toastError).not.toHaveBeenCalled();
    expect(input().value).toBe("");
  });

  it("rejects a video for a photo object without changing the source", async () => {
    mount([replaceItem()]);
    await screen.findByRole("button", { name: /Replace file/ });
    fireEvent.change(input(), { target: { files: [video()] } });

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(sourceLine().textContent).toContain("hero.webp");
  });

  it("rejects an unsupported file", async () => {
    mount([replaceItem()]);
    await screen.findByRole("button", { name: /Replace file/ });
    fireEvent.change(input(), { target: { files: [new File(["x"], "notes.txt", { type: "text/plain" })] } });

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(sourceLine().textContent).toContain("hero.webp");
  });

  it("rejects an oversized video for a video object", async () => {
    const big = new File([new Uint8Array(16)], "huge.mp4", { type: "video/mp4" });
    Object.defineProperty(big, "size", { value: 900 * 1024 * 1024 });
    mount([{
      id: "edit-clip", file: video(), kind: "video",
      replace: { name: "clip.mp4", size: 1024 },
    }]);
    await screen.findByRole("button", { name: /Replace file/ });
    fireEvent.change(input(), { target: { files: [big] } });

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(sourceLine().textContent).toContain("clip.mp4");
    expect(input().accept).toContain(".mp4");
  });

  it("allows picking the same file twice", async () => {
    mount([replaceItem()]);
    await screen.findByRole("button", { name: /Replace file/ });
    fireEvent.change(input(), { target: { files: [photo("again.jpg", 2048, "image/jpeg")] } });
    await waitFor(() => expect(sourceLine().textContent).toContain("again.jpg"));

    fireEvent.change(input(), { target: { files: [photo("again.jpg", 2048, "image/jpeg")] } });
    await waitFor(() => expect(sourceLine().textContent).toContain("again.jpg"));
    expect(toastError).not.toHaveBeenCalled();
  });
});
