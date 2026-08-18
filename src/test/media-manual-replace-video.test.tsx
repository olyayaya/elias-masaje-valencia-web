/**
 * VIDEO counterpart of the photo manual-replacement regression: a converted result that is
 * BIGGER than the stored object must still be replaceable. "Replace original" stays enabled,
 * no manual-unavailable / "Apply anyway" step exists, and commitVideoReplacement receives the
 * old target A plus an explicit mode:"manual".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const commitVideoReplacement = vi.fn(async (_a?: Record<string, unknown>) => ({ newName: "clip.mp4" }));
const replaceMediaFile = vi.fn(async () => ({ newName: "x" }));
const uploadResumable = vi.fn(async () => undefined);
const removeObject = vi.fn();

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock("@/lib/media-usage", () => ({
  replaceMediaFile: () => replaceMediaFile(),
  commitVideoReplacement: (a: Record<string, unknown>) => commitVideoReplacement(a),
}));

vi.mock("@/lib/video-upload", () => ({
  uploadResumable: (...a: unknown[]) => uploadResumable(...(a as [])),
  stagedObjectName: vi.fn(async (ext: string) => `staged-u-1.${ext}`),
  removeObject: (...a: unknown[]) => removeObject(...(a as [])),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: () => ({ upload: vi.fn(async () => ({ data: {}, error: null })) }) } },
}));

// The converted video is deliberately BIGGER than the stored object.
vi.mock("@/lib/video-ffmpeg", () => ({
  isConverterSupported: () => true,
  probeVideoMeta: vi.fn(async () => ({ width: 1920, height: 1080, duration: 10, hasAudio: true })),
  probeEncoders: vi.fn(async () => ({
    h264: true, vp9: true, aac: true, opus: true, mp3lame: false, vorbis: false,
  })),
  convertVideo: vi.fn(async () => ({ blob: new Blob([new Uint8Array(64)], { type: "video/mp4" }) })),
}));

import MediaProcessingDialog, { type ProcessingItem } from "@/components/dashboard/MediaProcessingDialog";
import { makeL } from "@/components/dashboard/media/i18n";

const L = makeL("en");

const item = (): ProcessingItem => ({
  id: "edit-clip",
  file: new File([new Uint8Array(1024)], "clip.mp4", { type: "video/mp4" }),
  kind: "video",
  replace: { name: "clip.mp4", size: 5 * 1024 * 1024, publishedInGallery: false },
});

beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
});

describe("video manual replacement", () => {
  it("keeps Replace original enabled and sends mode:manual with the stored target", async () => {
    const user = userEvent.setup();
    render(
      <MediaProcessingDialog
        items={[item()]}
        L={L}
        existingNames={["clip.mp4"]}
        onClose={vi.fn()}
        onApplied={vi.fn()}
      />,
    );
    await screen.findByText(/Edit or replace clip\.mp4/);

    const process = await screen.findByRole("button", { name: /Process/ });
    await waitFor(() => expect(process).toBeEnabled());
    await user.click(process);

    const apply = await screen.findByRole("button", { name: /Replace original/ });
    expect(apply).toBeEnabled();
    expect(screen.queryByRole("button", { name: /Apply anyway/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/media-guard/i)).not.toBeInTheDocument();

    await user.click(apply);
    await waitFor(() => expect(commitVideoReplacement).toHaveBeenCalledTimes(1));
    expect(commitVideoReplacement.mock.calls[0][0]).toMatchObject({
      fileName: "clip.mp4",
      newName: "clip.mp4",
      contentType: "video/mp4",
      mode: "manual",
    });
    expect(removeObject).not.toHaveBeenCalled();
  });
});
