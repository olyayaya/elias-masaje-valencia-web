/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";

const list = vi.fn(async () => [
  { name: "a.webp", mimeType: "image/webp" },
  { name: "b.webp", mimeType: "image/webp" },
  { name: "c.webp", mimeType: "image/webp" },
  { name: "clip.mp4", mimeType: "video/mp4" },
]);

vi.mock("@/lib/storage-list", () => ({ listAllMediaObjects: () => list() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({ getPublicUrl: (n: string) => ({ data: { publicUrl: `https://cdn.test/${n}` } }) }),
    },
  },
}));

import GalleryMediaPicker from "@/components/dashboard/GalleryMediaPicker";

const onSelect = vi.fn();
const onSelectMany = vi.fn();

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

const labels = {
  title: "Pick",
  description: "desc",
  emptyLabel: "empty",
  cancelLabel: "Cancel",
  selectLabel: "Select",
  addManyLabel: (n: number) => `Add ${n}`,
  selectAllLabel: "Select all",
  clearLabel: "Clear",
  selectedLabel: (n: number) => `${n} selected`,
};

const mount = (multiple: boolean) =>
  render(
    <GalleryMediaPicker
      open
      kind="photo"
      multiple={multiple}
      onClose={() => {}}
      onSelect={onSelect}
      onSelectMany={onSelectMany}
      {...labels}
    />,
  );

const tiles = async () => {
  const dialog = await screen.findByRole("dialog");
  await waitFor(() => expect(dialog.querySelectorAll("button[title]").length).toBe(3));
  return { dialog, buttons: Array.from(dialog.querySelectorAll("button[title]")) as HTMLElement[] };
};

describe("gallery picker multi-select", () => {
  it("toggles files on plain click and reports the count", async () => {
    mount(true);
    const { dialog, buttons } = await tiles();
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[2]);
    expect(buttons[0].getAttribute("aria-selected")).toBe("true");
    expect(within(dialog).getByText(/2 selected/)).toBeTruthy();
    fireEvent.click(buttons[0]);
    expect(buttons[0].getAttribute("aria-selected")).toBe("false");
  });

  it("adds an individual file with ctrl/cmd click", async () => {
    mount(true);
    const { buttons } = await tiles();
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1], { metaKey: true });
    fireEvent.click(buttons[2], { ctrlKey: true });
    fireEvent.click(await screen.findByRole("button", { name: "Add 3" }));
    expect(onSelectMany).toHaveBeenCalledWith([
      "https://cdn.test/a.webp",
      "https://cdn.test/b.webp",
      "https://cdn.test/c.webp",
    ]);
  });

  it("selects a range with shift click", async () => {
    mount(true);
    const { buttons } = await tiles();
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[2], { shiftKey: true });
    fireEvent.click(await screen.findByRole("button", { name: "Add 3" }));
    expect(onSelectMany.mock.calls[0][0]).toHaveLength(3);
  });

  it("selects all visible and clears, and keeps selection across a search", async () => {
    mount(true);
    const { dialog } = await tiles();
    fireEvent.click(within(dialog).getByRole("button", { name: "Select all" }));
    expect(within(dialog).getByText(/3 selected/)).toBeTruthy();

    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "a" } });
    await waitFor(() => expect(dialog.querySelectorAll("button[title]").length).toBe(1));
    expect(within(dialog).getByText(/3 selected/)).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "Clear" }));
    expect(within(dialog).queryByRole("button", { name: /^Add/ })).toBeNull();
  });

  it("stays single-select for replacement and poster pickers", async () => {
    mount(false);
    const { dialog, buttons } = await tiles();
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Select" }));
    expect(onSelectMany).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith("https://cdn.test/b.webp");
  });
});
