/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

import {
  getVisitorId,
  hasViewedInSession,
  isLiked,
  registerGalleryView,
  setLikedLocally,
  toggleGalleryLike,
  VISITOR_KEY,
} from "@/lib/gallery-engagement";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  rpc.mockReset();
  rpc.mockResolvedValue({ data: 1, error: null });
});

describe("gallery engagement", () => {
  it("keeps one stable random visitor id, with no personal data", () => {
    const id = getVisitorId();
    expect(id.length).toBeGreaterThanOrEqual(8);
    expect(getVisitorId()).toBe(id);
    expect(localStorage.getItem(VISITOR_KEY)).toBe(id);
  });

  it("counts a view once per item per session", async () => {
    expect(await registerGalleryView("item-1")).toBe(true);
    expect(hasViewedInSession("item-1")).toBe(true);
    expect(await registerGalleryView("item-1")).toBe(false);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("increment_gallery_view", { _item_id: "item-1" });
  });

  it("counts a different item separately", async () => {
    await registerGalleryView("a");
    await registerGalleryView("b");
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("persists the like locally and reports the server count", async () => {
    rpc.mockResolvedValue({ data: 7, error: null });
    const res = await toggleGalleryLike("item-1", true);
    expect(res).toEqual({ synced: true, likeCount: 7 });
    setLikedLocally("item-1", true);
    expect(isLiked("item-1")).toBe(true);
    setLikedLocally("item-1", false);
    expect(isLiked("item-1")).toBe(false);
  });

  it("reports a failed like so the caller can roll back", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "nope" } });
    expect(await toggleGalleryLike("item-1", true)).toEqual({ synced: false });
  });

  it("never surfaces a view error to the visitor", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "missing function" } });
    await expect(registerGalleryView("x")).resolves.toBe(false);
  });
});
