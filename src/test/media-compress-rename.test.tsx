import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const analyzeCompression = vi.fn();
const replaceMediaFile = vi.fn();
const renameMediaFile = vi.fn();
const checkMediaUsage = vi.fn();
const deleteMediaFile = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();
const storageRemove = vi.fn();
const toastWarning = vi.fn();

vi.mock("@/lib/media-usage", () => ({
  MediaGuardError: class MediaGuardError extends Error {
    alreadyCompressed: boolean;
    constructor(message: string, opts?: { alreadyCompressed?: boolean }) {
      super(message);
      this.name = "MediaGuardError";
      this.alreadyCompressed = !!opts?.alreadyCompressed;
    }
  },
  checkMediaUsage: (...a: unknown[]) => checkMediaUsage(...a),
  deleteMediaFile: (...a: unknown[]) => deleteMediaFile(...a),
  renameMediaFile: (...a: unknown[]) => renameMediaFile(...a),
  replaceMediaFile: (...a: unknown[]) => replaceMediaFile(...a),
}));

vi.mock("@/lib/media-compress", () => ({
  analyzeCompression: (...a: unknown[]) => analyzeCompression(...a),
  blobToBase64: async () => "AAAA",
}));

vi.mock("sonner", () => ({
  toast: {
    error: (...a: unknown[]) => toastError(...a),
    success: (...a: unknown[]) => toastSuccess(...a),
    warning: (...a: unknown[]) => toastWarning(...a),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({
        list: async () => ({
          data: [
            { name: "hero.jpg", metadata: { size: 500000 }, created_at: "2026-01-01" },
            { name: "taken.jpg", metadata: { size: 100 }, created_at: "2026-01-01" },
          ],
        }),
        getPublicUrl: (n: string) => ({ data: { publicUrl: `https://cdn.test/${n}` } }),
        remove: storageRemove,
      }),
    },
  },
}));

import DashboardMedia from "@/components/dashboard/DashboardMedia";
import { I18nProvider } from "@/i18n/context";

type Lang = "es" | "en" | "ru";

// The dashboard is fully localized; the provider picks the locale from the path.
const setup = async (lang: Lang = "en") => {
  window.history.replaceState({}, "", lang === "es" ? "/" : `/${lang}`);
  const user = userEvent.setup();
  render(
    <I18nProvider>
      <DashboardMedia />
    </I18nProvider>
  );
  await screen.findByText("hero.jpg");
  return user;
};

const LABEL = {
  rename: { es: "Renombrar", en: "Rename", ru: "Переименовать" },
  newName: { es: "Nombre nuevo", en: "New name", ru: "Новое имя" },
  renameTitle: { es: "Renombrar archivo", en: "Rename file", ru: "Переименовать файл" },
} as const;

beforeEach(() => vi.clearAllMocks());

describe("safe rename", () => {
  const openRename = async (lang: Lang = "en") => {
    const user = await setup(lang);
    await user.click(await screen.findByLabelText(`${LABEL.rename[lang]} hero.jpg`));
    await screen.findByText(LABEL.renameTitle[lang]);
    return user;
  };

  const type = async (user: ReturnType<typeof userEvent.setup>, value: string, lang: Lang = "en") => {
    const input = screen.getByLabelText(LABEL.newName[lang]);
    await user.clear(input);
    await user.type(input, value);
    await user.click(screen.getByRole("button", { name: LABEL.rename[lang] }));
  };

  it("renames and reports how many links were updated", async () => {
    renameMediaFile.mockResolvedValue({ fileName: "hero.jpg", newName: "masaje-valencia.jpg", renamed: true, updatedReferences: 5 });
    const user = await openRename();
    await type(user, "masaje-valencia.jpg");
    await waitFor(() => expect(renameMediaFile).toHaveBeenCalledWith("hero.jpg", "masaje-valencia.jpg"));
    expect(toastSuccess.mock.calls[0][0]).toMatch(/5 link/);
  });

  it("rejects a name that collides with an existing file", async () => {
    const user = await openRename();
    await type(user, "taken.jpg");
    expect(await screen.findByText("A file with that name already exists")).toBeInTheDocument();
    expect(renameMediaFile).not.toHaveBeenCalled();
  });

  it("rejects path traversal and empty names", async () => {
    const user = await openRename();
    await type(user, "../evil.jpg");
    expect(await screen.findByText("Name cannot contain paths")).toBeInTheDocument();
    const emptyInput = screen.getByLabelText(LABEL.newName.en);
    await user.clear(emptyInput);
    await user.click(screen.getByRole("button", { name: LABEL.rename.en }));
    expect(await screen.findByText("Name cannot be empty")).toBeInTheDocument();
    expect(renameMediaFile).not.toHaveBeenCalled();
  });

  it("requires keeping the extension (format changes go through compression)", async () => {
    const user = await openRename();
    await type(user, "hero.webp");
    expect(await screen.findByText(/Keep the .jpg extension/)).toBeInTheDocument();
    expect(renameMediaFile).not.toHaveBeenCalled();
  });

  it("shows a server rollback error and keeps the dialog open", async () => {
    renameMediaFile.mockRejectedValue(new Error("Rename rolled back: blog_posts: boom"));
    const user = await openRename();
    await type(user, "new-name.jpg");
    expect(await screen.findByText(/Rename rolled back/)).toBeInTheDocument();
    expect(storageRemove).not.toHaveBeenCalled();
  });

  it("never deletes a real file as part of rename or compression", async () => {
    const user = await openRename();
    await type(user, "another.jpg");
    expect(deleteMediaFile).not.toHaveBeenCalled();
    expect(storageRemove).not.toHaveBeenCalled();
  });
});

describe("localization and server outcome reporting", () => {
  const ready = {
    status: "ready",
    blob: new Blob(["x"], { type: "image/webp" }),
    newName: "hero.webp",
    originalSize: 500000,
    newSize: 200000,
    savedBytes: 300000,
    savedPercent: 60,
  };

  it("tells the admin that archived versions now resolve to the new name", async () => {
    renameMediaFile.mockResolvedValue({
      fileName: "hero.jpg",
      newName: "masaje-valencia.jpg",
      renamed: true,
      updatedReferences: 5,
      aliased: true,
      historyReferences: 3,
    });
    const user = await setup("en");
    await user.click(await screen.findByLabelText("Rename hero.jpg"));
    await screen.findByText("Rename file");
    const input = screen.getByLabelText("New name");
    await userEvent.clear(input);
    await userEvent.type(input, "masaje-valencia.jpg");
    await user.click(screen.getByRole("button", { name: "Rename" }));
    await waitFor(() => expect(renameMediaFile).toHaveBeenCalled());
    const messages = toastSuccess.mock.calls.map((c) => String(c[0])).join(" | ");
    expect(messages).toMatch(/3 archived version\(s\) referenced the old name/);
  });

  it("surfaces a leftover-object warning from the server", async () => {
    renameMediaFile.mockResolvedValue({
      fileName: "hero.jpg",
      newName: "new.jpg",
      renamed: true,
      updatedReferences: 1,
      warning: "Old object could not be removed: locked",
    });
    const user = await setup("en");
    await user.click(await screen.findByLabelText("Rename hero.jpg"));
    await screen.findByText("Rename file");
    const input = screen.getByLabelText("New name");
    await userEvent.clear(input);
    await userEvent.type(input, "new.jpg");
    await user.click(screen.getByRole("button", { name: "Rename" }));
    await waitFor(() => expect(renameMediaFile).toHaveBeenCalled());
    expect(toastWarning.mock.calls.map((c) => String(c[0])).join(" | ")).toMatch(/could not be removed/);
  });
});
