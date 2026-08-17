import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const checkMediaUsage = vi.fn();
const deleteMediaFile = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();

vi.mock("@/lib/media-usage", () => ({
  checkMediaUsage: (...a: unknown[]) => checkMediaUsage(...a),
  deleteMediaFile: (...a: unknown[]) => deleteMediaFile(...a),
}));

vi.mock("sonner", () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: (...a: unknown[]) => toastSuccess(...a) },
}));

const storageRemove = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({
        list: async () => ({
          data: [{ name: "hero.webp", metadata: { size: 1024 }, created_at: "2026-01-01" }],
        }),
        getPublicUrl: (n: string) => ({ data: { publicUrl: `https://cdn.test/${n}` } }),
        remove: storageRemove,
      }),
    },
  },
}));

import DashboardMedia from "@/components/dashboard/DashboardMedia";
import { I18nProvider } from "@/i18n/context";

const openDeleteDialog = async () => {
  // The media dashboard is localized; /en pins the English copy asserted below.
  window.history.replaceState({}, "", "/en");
  const user = userEvent.setup();
  render(
    <I18nProvider>
      <DashboardMedia />
    </I18nProvider>
  );
  const btn = await screen.findByLabelText("Delete hero.webp");
  await user.click(btn);
  return user;
};


beforeEach(() => {
  vi.clearAllMocks();
});

describe("DashboardMedia safe delete", () => {
  it("blocks deletion when the file is used in a blog post", async () => {
    checkMediaUsage.mockResolvedValue({
      fileName: "hero.webp",
      inUse: true,
      usages: [{ entity: "Blog post", label: "Masaje deportivo", id: "abc12345", field: "content_es" }],
    });
    await openDeleteDialog();
    expect(await screen.findByText("This file is still in use")).toBeInTheDocument();
    expect(screen.getByText(/Masaje deportivo/)).toBeInTheDocument();
    expect(screen.queryByText("Delete permanently")).not.toBeInTheDocument();
    expect(deleteMediaFile).not.toHaveBeenCalled();
  });

  it("blocks deletion when the file is used in a carousel or site content", async () => {
    checkMediaUsage.mockResolvedValue({
      fileName: "hero.webp",
      inUse: true,
      usages: [
        { entity: "Image / carousel", label: "home_hero", id: "def67890", field: "image_url" },
        { entity: "Site content", label: "About photo", id: "ghi11111", field: "value_es" },
      ],
    });
    await openDeleteDialog();
    expect(await screen.findByText("This file is still in use")).toBeInTheDocument();
    expect(screen.getByText(/home_hero/)).toBeInTheDocument();
    expect(screen.getByText(/About photo/)).toBeInTheDocument();
    expect(deleteMediaFile).not.toHaveBeenCalled();
  });

  it("asks for confirmation when the file is unused", async () => {
    checkMediaUsage.mockResolvedValue({ fileName: "hero.webp", inUse: false, usages: [] });
    await openDeleteDialog();
    expect(await screen.findByText("Delete hero.webp?")).toBeInTheDocument();
    expect(screen.getByText(/permanent and cannot be undone/i)).toBeInTheDocument();
    expect(deleteMediaFile).not.toHaveBeenCalled();
  });

  it("cancel deletes nothing", async () => {
    checkMediaUsage.mockResolvedValue({ fileName: "hero.webp", inUse: false, usages: [] });
    const user = await openDeleteDialog();
    await screen.findByText("Delete hero.webp?");
    await user.click(screen.getByText("Cancel"));
    await waitFor(() => expect(screen.queryByText("Delete hero.webp?")).not.toBeInTheDocument());
    expect(deleteMediaFile).not.toHaveBeenCalled();
    expect(storageRemove).not.toHaveBeenCalled();
  });

  it("confirmed deletion calls the guarded delete exactly once", async () => {
    checkMediaUsage.mockResolvedValue({ fileName: "hero.webp", inUse: false, usages: [] });
    deleteMediaFile.mockResolvedValue({ fileName: "hero.webp", deleted: true, inUse: false, usages: [] });
    const user = await openDeleteDialog();
    await user.click(await screen.findByText("Delete permanently"));
    await waitFor(() => expect(deleteMediaFile).toHaveBeenCalledTimes(1));
    expect(deleteMediaFile).toHaveBeenCalledWith("hero.webp");
    expect(storageRemove).not.toHaveBeenCalled();
  });

  it("blocks deletion when the file is used in an FAQ answer", async () => {
    checkMediaUsage.mockResolvedValue({
      fileName: "hero.webp",
      inUse: true,
      historyReferences: 0,
      usages: [{ entity: "FAQ", label: "¿Cómo reservo?", id: "faq11111", field: "answer_ru" }],
    });
    await openDeleteDialog();
    expect(await screen.findByText("This file is still in use")).toBeInTheDocument();
    expect(screen.getByText(/¿Cómo reservo\?/)).toBeInTheDocument();
    expect(deleteMediaFile).not.toHaveBeenCalled();
  });

  it("shows a non-blocking warning when only archived history references the file", async () => {
    checkMediaUsage.mockResolvedValue({ fileName: "hero.webp", inUse: false, usages: [], historyReferences: 3 });
    await openDeleteDialog();
    expect(await screen.findByText("Delete hero.webp?")).toBeInTheDocument();
    expect(screen.getByText(/archived version/)).toBeInTheDocument();
    expect(screen.getByText("Delete permanently")).toBeInTheDocument();
  });

  it("surfaces errors from the usage check", async () => {
    checkMediaUsage.mockRejectedValue(new Error("Forbidden — admin only"));
    await openDeleteDialog();
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Forbidden — admin only"));
    expect(screen.queryByText(/Delete hero.webp\?/)).not.toBeInTheDocument();
  });

  it("surfaces errors from the delete call", async () => {
    checkMediaUsage.mockResolvedValue({ fileName: "hero.webp", inUse: false, usages: [] });
    deleteMediaFile.mockRejectedValue(new Error("Storage unavailable"));
    const user = await openDeleteDialog();
    await user.click(await screen.findByText("Delete permanently"));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Storage unavailable"));
  });
});
