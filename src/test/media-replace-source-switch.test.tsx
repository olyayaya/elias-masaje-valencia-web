/**
 * Picking a new local source in "Edit or replace" must switch the editor entirely to that
 * file: its preview, its real size and its real dimensions — while the replace TARGET
 * (stored object name/size) stays untouched so Apply still replaces the original object.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const replaceMediaFile = vi.fn(async () => ({ newName: "hero.webp" }));
const encodePhoto = vi.fn(async () => ({
  blob: new Blob([new Uint8Array(1024)], { type: "image/webp" }),
  size: 1024, mime: "image/webp", format: "webp" as const, width: 1920, height: 960,
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock("@/lib/media-usage", () => ({
  replaceMediaFile: (...a: unknown[]) => replaceMediaFile(...(a as [])),
  commitVideoReplacement: vi.fn(async () => ({ newName: "clip.mp4" })),
}));

vi.mock("@/lib/video-upload", () => ({
  uploadResumable: vi.fn(), stagedObjectName: vi.fn(async () => "staged/x.mp4"), removeObject: vi.fn(),
}));

vi.mock("@/lib/media-compress", () => ({ blobToBase64: vi.fn(async () => "AAA") }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: () => ({ upload: vi.fn(async () => ({ data: {}, error: null })) }) } },
}));

/** Dimensions are keyed by file name so file A and file B decode differently. */
const DIMS: Record<string, { w: number; h: number }> = {
  "hero.webp": { w: 800, h: 400 },
  "brand-new.jpg": { w: 4032, h: 2268 },
  "third.jpg": { w: 1000, h: 1000 },
};
let slowFor: string | null = null;

vi.mock("@/lib/photo-encode", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/photo-encode")>();
  return {
    ...actual,
    probePhotoCaps: () => ({ webp: true, jpg: true, png: true }),
    loadImageElement: vi.fn(async (blob: Blob) => {
      const name = (blob as File).name;
      const d = DIMS[name] ?? { w: 100, h: 100 };
      if (slowFor === name) await new Promise((r) => setTimeout(r, 60));
      return { naturalWidth: d.w, naturalHeight: d.h } as HTMLImageElement;
    }),
    encodePhoto: (...a: unknown[]) => encodePhoto(...(a as [])),
  };
});

import MediaProcessingDialog, { type ProcessingItem } from "@/components/dashboard/MediaProcessingDialog";
import { makeL } from "@/components/dashboard/media/i18n";

const L = makeL("en");
const file = (name: string, bytes: number, type: string) =>
  new File([new Uint8Array(bytes)], name, { type });

const STORED_SIZE = 400 * 1024;
const replaceItem = (): ProcessingItem => ({
  id: "edit-hero",
  file: file("hero.webp", STORED_SIZE, "image/webp"),
  kind: "photo",
  replace: { name: "hero.webp", size: STORED_SIZE, publishedInGallery: false },
});

const mount = (items: ProcessingItem[]) =>
  render(
    <MediaProcessingDialog items={items} L={L} existingNames={["hero.webp"]} onClose={vi.fn()} onApplied={vi.fn()} />,
  );

const input = () => document.querySelector('[data-testid="replace-file-input"]') as HTMLInputElement;
const sourceLine = () => screen.getByText(/File 1 of 1/);

beforeEach(() => {
  vi.clearAllMocks();
  slowFor = null;
  URL.createObjectURL = vi.fn(() => `blob:mock-${Math.random()}`);
  URL.revokeObjectURL = vi.fn();
});

describe("selected file becomes the only working source", () => {
  it("shows the selected file name, its real size and its real resolution", async () => {
    mount([replaceItem()]);
    await waitFor(() => expect(sourceLine().textContent).toContain("800×400"));

    fireEvent.change(input(), { target: { files: [file("brand-new.jpg", 98 * 1024, "image/jpeg")] } });

    await waitFor(() => expect(sourceLine().textContent).toContain("4032×2268"));
    expect(sourceLine().textContent).toContain("brand-new.jpg");
    expect(sourceLine().textContent).not.toContain("800×400");
    // The panel is labelled "Selected file", not "Original", and shows the selected size.
    expect(screen.getAllByText("Selected file").length).toBeGreaterThan(0);
    expect(screen.getByText(/brand-new\.jpg · 98 KB/)).toBeInTheDocument();
  });

  it("keeps the replace target visible as metadata only", async () => {
    mount([replaceItem()]);
    fireEvent.change(input(), { target: { files: [file("brand-new.jpg", 98 * 1024, "image/jpeg")] } });
    await waitFor(() => expect(sourceLine().textContent).toContain("brand-new.jpg"));
    expect(screen.getByText(/Will replace: hero\.webp/)).toBeInTheDocument();
  });

  it("clears stale metadata immediately while the new file decodes", async () => {
    mount([replaceItem()]);
    await waitFor(() => expect(sourceLine().textContent).toContain("800×400"));

    slowFor = "brand-new.jpg";
    fireEvent.change(input(), { target: { files: [file("brand-new.jpg", 98 * 1024, "image/jpeg")] } });

    // Old dimensions must be gone before the new ones arrive.
    expect(sourceLine().textContent).not.toContain("800×400");
    await waitFor(() => expect(sourceLine().textContent).toContain("4032×2268"));
  });

  it("a late decode of the previous file cannot overwrite the selected one", async () => {
    slowFor = "hero.webp";
    mount([replaceItem()]);
    fireEvent.change(input(), { target: { files: [file("brand-new.jpg", 98 * 1024, "image/jpeg")] } });

    await waitFor(() => expect(sourceLine().textContent).toContain("4032×2268"));
    await new Promise((r) => setTimeout(r, 120));
    expect(sourceLine().textContent).toContain("4032×2268");
    expect(sourceLine().textContent).not.toContain("800×400");
  });

  it("picking a further file does not bring back the previous preview", async () => {
    mount([replaceItem()]);
    fireEvent.change(input(), { target: { files: [file("brand-new.jpg", 98 * 1024, "image/jpeg")] } });
    await waitFor(() => expect(sourceLine().textContent).toContain("4032×2268"));

    fireEvent.change(input(), { target: { files: [file("third.jpg", 50 * 1024, "image/jpeg")] } });
    await waitFor(() => expect(sourceLine().textContent).toContain("1000×1000"));
    expect(sourceLine().textContent).not.toContain("4032×2268");
    expect(sourceLine().textContent).toContain("third.jpg");
  });
});

describe("processing and applying use the right file", () => {
  it("Process receives the selected file and Apply replaces the stored target", async () => {
    mount([replaceItem()]);
    const picked = file("brand-new.jpg", 98 * 1024, "image/jpeg");
    fireEvent.change(input(), { target: { files: [picked] } });
    await waitFor(() => expect(sourceLine().textContent).toContain("4032×2268"));

    fireEvent.click(screen.getByRole("button", { name: /Process/ }));
    await waitFor(() => expect(encodePhoto).toHaveBeenCalledTimes(1));
    expect(encodePhoto.mock.calls[0][0]).toBe(picked);

    fireEvent.click(await screen.findByRole("button", { name: /Replace original/ }));
    await waitFor(() => expect(replaceMediaFile).toHaveBeenCalledTimes(1));
    const arg = replaceMediaFile.mock.calls[0][0] as unknown as {
      fileName: string; newName: string; originalSize: number;
    };
    expect(arg.fileName).toBe("hero.webp");
    expect(arg.originalSize).toBe(STORED_SIZE);
    expect(arg.newName).toBe("hero.webp");
  });
});

describe("plain uploads are unaffected", () => {
  it("a new upload without a replace target keeps the Original label and no picker", async () => {
    mount([{ id: "up-1", file: file("brand-new.jpg", 98 * 1024, "image/jpeg"), kind: "photo" }]);
    await screen.findByText("Prepare media");
    expect(screen.getAllByText("Original").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Will replace:/)).not.toBeInTheDocument();
    expect(input()).toBeNull();
  });
});
