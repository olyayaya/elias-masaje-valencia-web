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

class MediaGuardError extends Error {
  alreadyCompressed: boolean;
  constructor(message: string, opts?: { alreadyCompressed?: boolean }) {
    super(message);
    this.name = "MediaGuardError";
    this.alreadyCompressed = !!opts?.alreadyCompressed;
  }
}

vi.mock("@/lib/media-usage", () => ({
  MediaGuardError,
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
  toast: { error: (...a: unknown[]) => toastError(...a), success: (...a: unknown[]) => toastSuccess(...a) },
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
  compress: { es: "Compresión inteligente", en: "Smart compress", ru: "Умное сжатие" },
  rename: { es: "Renombrar", en: "Rename", ru: "Переименовать" },
  newName: { es: "Nombre nuevo", en: "New name", ru: "Новое имя" },
  renameTitle: { es: "Renombrar archivo", en: "Rename file", ru: "Переименовать файл" },
} as const;

const clickCompress = async (user: ReturnType<typeof userEvent.setup>, lang: Lang = "en") =>
  user.click(await screen.findByLabelText(`${LABEL.compress[lang]} hero.jpg`));

beforeEach(() => vi.clearAllMocks());

describe("smart compression", () => {
  it("replaces the file and reports the saving when compression helps", async () => {
    analyzeCompression.mockResolvedValue({
      status: "ready",
      blob: new Blob(["x"], { type: "image/webp" }),
      newName: "hero.webp",
      originalSize: 500000,
      newSize: 200000,
      savedBytes: 300000,
      savedPercent: 60,
    });
    replaceMediaFile.mockResolvedValue({ fileName: "hero.jpg", newName: "hero.webp", replaced: true, updatedReferences: 3 });
    const user = await setup();
    await clickCompress(user);
    await waitFor(() => expect(replaceMediaFile).toHaveBeenCalledTimes(1));
    expect(replaceMediaFile).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: "hero.jpg", newName: "hero.webp", originalSize: 500000 })
    );
    expect(toastSuccess.mock.calls[0][0]).toMatch(/−60%/);
    expect(storageRemove).not.toHaveBeenCalled();
  });

  it("does nothing when the image is already compressed", async () => {
    analyzeCompression.mockResolvedValue({ status: "already", originalSize: 100, candidateSize: 99 });
    const user = await setup();
    await clickCompress(user);
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Image is already compressed — nothing was changed"));
    expect(replaceMediaFile).not.toHaveBeenCalled();
  });

  it("shows a clear message for unsupported formats", async () => {
    analyzeCompression.mockResolvedValue({ status: "unsupported", reason: "GIF animation cannot be re-encoded without losing the animation" });
    const user = await setup();
    await clickCompress(user);
    await waitFor(() => expect(toastError.mock.calls[0][0]).toMatch(/GIF animation/));
    expect(replaceMediaFile).not.toHaveBeenCalled();
  });

  it("surfaces a server rejection (result not smaller) without deleting anything", async () => {
    analyzeCompression.mockResolvedValue({
      status: "ready",
      blob: new Blob(["x"], { type: "image/webp" }),
      newName: "hero.webp",
      originalSize: 100,
      newSize: 90,
      savedBytes: 10,
      savedPercent: 10,
    });
    replaceMediaFile.mockRejectedValue(new Error("Compressed result is not smaller — file left untouched"));
    const user = await setup();
    await clickCompress(user);
    await waitFor(() => expect(toastError.mock.calls[0][0]).toMatch(/not smaller/));
    expect(storageRemove).not.toHaveBeenCalled();
    expect(deleteMediaFile).not.toHaveBeenCalled();
  });

  it("surfaces a server error", async () => {
    analyzeCompression.mockRejectedValue(new Error("Could not read the source file (403)"));
    const user = await setup();
    await clickCompress(user);
    await waitFor(() => expect(toastError.mock.calls[0][0]).toMatch(/Could not read/));
  });
});

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

  it("reports compression in Spanish", async () => {
    analyzeCompression.mockResolvedValue(ready);
    replaceMediaFile.mockResolvedValue({ replaced: true, updatedReferences: 2 });
    const user = await setup("es");
    await clickCompress(user, "es");
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(toastSuccess.mock.calls[0][0]).toMatch(/Comprimida:/);
    expect(toastSuccess.mock.calls[0][0]).toMatch(/2 enlace/);
  });

  it("reports compression in Russian", async () => {
    analyzeCompression.mockResolvedValue(ready);
    replaceMediaFile.mockResolvedValue({ replaced: true, updatedReferences: 2 });
    const user = await setup("ru");
    await clickCompress(user, "ru");
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(toastSuccess.mock.calls[0][0]).toMatch(/Сжато:/);
    expect(toastSuccess.mock.calls[0][0]).toMatch(/обновлено ссылок: 2/);
  });

  it("says nothing changed, localized, when the server reports an already-compressed file", async () => {
    analyzeCompression.mockResolvedValue({ status: "already", originalSize: 100, candidateSize: 99 });
    const user = await setup("ru");
    await clickCompress(user, "ru");
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Изображение уже сжато — ничего не изменено")
    );
    expect(replaceMediaFile).not.toHaveBeenCalled();
  });

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
    expect(toastError.mock.calls.map((c) => String(c[0])).join(" | ")).toMatch(/could not be removed/);
  });
});
