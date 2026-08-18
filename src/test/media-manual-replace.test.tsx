/**
 * A confirmed replacement of an existing library object must always be possible — even when
 * the result is not smaller than the stored file. The dialog sends an explicit
 * mode:"manual" so the deployed media-guard skips ONLY the saving threshold.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const replaceMediaFile = vi.fn(async () => ({ newName: "hero.webp" }));
const commitVideoReplacement = vi.fn(async () => ({ newName: "clip.mp4" }));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock("@/lib/media-usage", () => ({
  replaceMediaFile: (...a: unknown[]) => replaceMediaFile(...(a as [])),
  commitVideoReplacement: (...a: unknown[]) => commitVideoReplacement(...(a as [])),
}));

vi.mock("@/lib/video-upload", () => ({
  uploadResumable: vi.fn(async () => undefined),
  stagedObjectName: vi.fn(async () => "staged/x.mp4"),
  removeObject: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: () => ({ upload: vi.fn(async () => ({ data: {}, error: null })) }) } },
}));

// The encoded photo is deliberately BIGGER than both the selected source and the stored file.
vi.mock("@/lib/photo-encode", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/photo-encode")>();
  return {
    ...actual,
    probePhotoCaps: () => ({ webp: true, jpg: true, png: true }),
    loadImageElement: vi.fn(async () => ({ naturalWidth: 2400, naturalHeight: 1200 }) as HTMLImageElement),
    encodePhoto: vi.fn(async () => ({
      blob: new Blob([new Uint8Array(64)], { type: "image/webp" }),
      size: 900 * 1024, mime: "image/webp", format: "webp" as const, width: 1920, height: 960,
    })),
  };
});

import MediaProcessingDialog, { type ProcessingItem } from "@/components/dashboard/MediaProcessingDialog";
import { makeL } from "@/components/dashboard/media/i18n";

const L = makeL("en");

const item = (): ProcessingItem => ({
  id: "edit-hero",
  file: new File([new Uint8Array(400 * 1024)], "hero.webp", { type: "image/webp" }),
  kind: "photo",
  replace: { name: "hero.webp", size: 400 * 1024, publishedInGallery: false },
});

const mount = () =>
  render(
    <MediaProcessingDialog
      items={[item()]}
      L={L}
      existingNames={["hero.webp"]}
      onClose={vi.fn()}
      onApplied={vi.fn()}
    />,
  );

beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
});

describe("manual replacement without a saving threshold", () => {
  it("keeps Replace original enabled for a bigger result and sends mode:manual", async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByText(/Edit or replace hero\.webp/);

    await user.click(screen.getByRole("button", { name: /Process/ }));
    const apply = await screen.findByRole("button", { name: /Replace original/ });
    expect(apply).toBeEnabled();

    // No "Apply anyway" second step and no obsolete deployment warning.
    expect(screen.queryByRole("button", { name: /Apply anyway/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/media-guard/i)).not.toBeInTheDocument();

    await user.click(apply);
    await waitFor(() => expect(replaceMediaFile).toHaveBeenCalledTimes(1));
    expect(replaceMediaFile.mock.calls[0][0]).toMatchObject({
      fileName: "hero.webp",
      newName: "hero.webp",
      mode: "manual",
    });
  });
});
