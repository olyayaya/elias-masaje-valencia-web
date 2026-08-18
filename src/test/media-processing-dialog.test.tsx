/**
 * The real contract of the shared processing dialog: every entry point (file input, drag &
 * drop, Edit/Replace on an existing object) opens the SAME dialog, and NOTHING reaches
 * Storage or the media-guard Edge Function until Apply succeeds.
 *
 * The dialog itself is rendered for real here — only the encoders are stubbed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const upload = vi.fn(async (..._a: unknown[]) => ({ data: { path: "x" }, error: null }));
const uploadResumable = vi.fn(async (..._a: unknown[]) => undefined);
const replaceMediaFile = vi.fn(async (..._a: unknown[]) => ({ newName: "hero.webp" }));
const commitVideoReplacement = vi.fn(async (..._a: unknown[]) => ({ newName: "promo.mp4" }));
const toastSuccess = vi.fn();
const toastInfo = vi.fn();

/** Every mutation path the Library can possibly take. Must stay silent before Apply. */
const mutations = () => [
  ...upload.mock.calls, ...uploadResumable.mock.calls,
  ...replaceMediaFile.mock.calls, ...commitVideoReplacement.mock.calls,
];

vi.mock("@/lib/media-usage", () => ({
  checkMediaUsage: vi.fn(async () => ({ usages: [] })),
  checkMediaUsageBatch: vi.fn(async () => ({ usage: {} })),
  deleteMediaFile: vi.fn(),
  renameMediaFile: vi.fn(),
  replaceMediaFile: (...a: unknown[]) => replaceMediaFile(...a),
  commitVideoReplacement: (...a: unknown[]) => commitVideoReplacement(...a),
  MediaGuardError: class extends Error {},
}));

vi.mock("@/lib/video-upload", () => ({
  uploadResumable: (...a: unknown[]) => uploadResumable(...a),
  stagedObjectName: vi.fn(async () => "staged/x.mp4"),
  removeObject: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: (...a: unknown[]) => toastSuccess(...a),
    info: (...a: unknown[]) => toastInfo(...a),
    warning: vi.fn(),
  },
}));

const OBJECTS = [
  { name: "hero.webp", metadata: { size: 500 * 1024, mimetype: "image/webp" }, created_at: "2026-01-02T00:00:00Z" },
];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({
        list: async () => ({ data: OBJECTS, error: null }),
        download: async () => ({ data: new Blob(["original-bytes"], { type: "image/webp" }), error: null }),
        getPublicUrl: (n: string) => ({ data: { publicUrl: `https://cdn.test/${n}` } }),
        upload: (...a: unknown[]) => upload(...a),
        remove: vi.fn(),
      }),
    },
  },
}));

// Canvas encoding does not exist in jsdom: stub the two browser-only helpers, keep the
// pure policy functions (clamp, dimensions, presets) real so the dialog behaves normally.
vi.mock("@/lib/photo-encode", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/photo-encode")>();
  return {
    ...actual,
    probePhotoCaps: () => ({ webp: true, jpg: true, png: true }),
    loadImageElement: vi.fn(async () => ({ naturalWidth: 2400, naturalHeight: 1200 }) as HTMLImageElement),
    encodePhoto: vi.fn(async () => ({
      // Clearly smaller than the 500 KB source, so the saving gate passes.
      blob: new Blob([new Uint8Array(1024)], { type: "image/webp" }),
      size: 1024, mime: "image/webp", format: "webp" as const, width: 1920, height: 960,
    })),
  };
});

import DashboardMedia from "@/components/dashboard/DashboardMedia";
import { I18nProvider } from "@/i18n/context";

const photoFile = (name = "new-photo.jpg") =>
  new File([new Uint8Array(200 * 1024)], name, { type: "image/jpeg" });

const renderLibrary = async () => {
  window.history.replaceState({}, "", "/en");
  const user = userEvent.setup();
  const { container } = render(
    <I18nProvider>
      <DashboardMedia />
    </I18nProvider>,
  );
  await screen.findByText("hero.webp");
  return { user, container };
};

const fileInput = (container: HTMLElement) =>
  container.querySelector('input[type="file"]') as HTMLInputElement;

beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
});

describe("every entry point opens the shared dialog", () => {
  it("file input queues the file into the dialog without any mutation", async () => {
    const { container } = await renderLibrary();
    fireEvent.change(fileInput(container), { target: { files: [photoFile()] } });

    expect(await screen.findByText("Prepare media")).toBeInTheDocument();
    expect(screen.getAllByText(/new-photo\.jpg/).length).toBeGreaterThan(0);
    expect(mutations()).toHaveLength(0);
  });

  it("drag & drop opens the same dialog and also mutates nothing", async () => {
    const { container } = await renderLibrary();
    const zone = screen.getByText(/Drop photos or videos here/i).closest("div") as HTMLElement;
    fireEvent.drop(zone, { dataTransfer: { files: [photoFile("dropped.jpg")] } });

    expect(await screen.findByText("Prepare media")).toBeInTheDocument();
    expect(screen.getAllByText(/dropped\.jpg/).length).toBeGreaterThan(0);
    expect(fileInput(container).value).toBe("");
    expect(mutations()).toHaveLength(0);
  });

  it("Edit or replace on an existing object reuses the dialog in replace mode", async () => {
    const { user } = await renderLibrary();
    await user.click(screen.getByLabelText("Edit or replace hero.webp"));
    expect(await screen.findByText(/Edit or replace hero\.webp/)).toBeInTheDocument();
    expect(mutations()).toHaveLength(0);
  });
});

describe("local processing stays local", () => {
  it("processing a queued file produces a preview but uploads nothing", async () => {
    const { user, container } = await renderLibrary();
    fireEvent.change(fileInput(container), { target: { files: [photoFile()] } });
    await screen.findByText("Prepare media");

    await user.click(screen.getByRole("button", { name: /Process/ }));
    await screen.findByRole("button", { name: /^Apply$/ });
    expect(mutations()).toHaveLength(0);
  });

  it("Keep original discards the result without any Storage or Edge mutation", async () => {
    const { user, container } = await renderLibrary();
    fireEvent.change(fileInput(container), { target: { files: [photoFile()] } });
    await screen.findByText("Prepare media");

    await user.click(screen.getByRole("button", { name: /Process/ }));
    await screen.findByRole("button", { name: /Keep original/ });
    await user.click(screen.getByRole("button", { name: /Keep original/ }));

    await waitFor(() => expect(screen.queryByRole("button", { name: /^Apply$/ })).not.toBeInTheDocument());
    expect(screen.getByText("Not processed yet")).toBeInTheDocument();
    expect(mutations()).toHaveLength(0);
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("only Apply performs the upload — and reports success exactly once", async () => {
    const { user, container } = await renderLibrary();
    fireEvent.change(fileInput(container), { target: { files: [photoFile()] } });
    await screen.findByText("Prepare media");

    await user.click(screen.getByRole("button", { name: /Process/ }));
    await user.click(await screen.findByRole("button", { name: /^Apply$/ }));

    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    expect(String(upload.mock.calls[0][0])).toMatch(/new-photo\.webp$/);
    expect(uploadResumable).not.toHaveBeenCalled();
    expect(replaceMediaFile).not.toHaveBeenCalled();
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
  });

  it("a queue of same-named files does not collide with names applied in this run", async () => {
    const { user, container } = await renderLibrary();
    fireEvent.change(fileInput(container), {
      target: { files: [photoFile("shot.jpg"), photoFile("shot.png")] },
    });
    await screen.findByText("Prepare media");

    for (let i = 0; i < 2; i++) {
      await user.click(screen.getByRole("button", { name: /Process/ }));
      await user.click(await screen.findByRole("button", { name: /^Apply$/ }));
      await waitFor(() => expect(upload).toHaveBeenCalledTimes(i + 1));
    }
    const names = upload.mock.calls.map((c) => c[0]);
    expect(String(names[0])).toMatch(/shot\.webp$/);
    expect(names[1]).not.toBe(names[0]);
  });
});
