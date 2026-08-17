import { describe, it, expect, vi } from "vitest";
import { listAllMediaNames, listAllMediaObjects, type StorageListFn } from "@/lib/storage-list";

const page = (names: string[]) => ({
  data: names.map((name) => ({ name, metadata: { mimetype: "image/webp" } })),
  error: null,
});

describe("paginated storage listing", () => {
  it("walks every page until a short one and returns the full set", async () => {
    const list = vi.fn(async (_p: string, o: { limit: number; offset: number }) => {
      if (o.offset === 0) return page(["a.webp", "b.webp"]);
      if (o.offset === 2) return page(["c.webp", "d.webp"]);
      return page(["e.webp"]);
    }) as unknown as StorageListFn;

    const files = await listAllMediaObjects({ pageSize: 2, list });
    expect(files.map((f) => f.name)).toEqual(["a.webp", "b.webp", "c.webp", "d.webp", "e.webp"]);
    expect((list as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(3);
    expect(files[0].mimeType).toBe("image/webp");
  });

  it("skips placeholders and de-duplicates repeated names", async () => {
    const list = vi.fn(async (_p: string, o: { offset: number }) =>
      o.offset === 0 ? page([".emptyFolderPlaceholder", "a.webp"]) : page(["a.webp", "b.webp"]),
    ) as unknown as StorageListFn;
    const names = await listAllMediaNames({ pageSize: 2, list });
    expect(names).toEqual(["a.webp", "b.webp"]);
  });

  it("terminates instead of looping when the backend keeps returning the same page", async () => {
    const list = vi.fn(async () => page(["a.webp", "b.webp"])) as unknown as StorageListFn;
    const names = await listAllMediaNames({ pageSize: 2, list });
    expect(names).toEqual(["a.webp", "b.webp"]);
    expect((list as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
  });

  it("rejects instead of returning a silently truncated list at the ceiling", async () => {
    const list = vi.fn(async (_p: string, o: { offset: number }) =>
      page([`f${o.offset}.webp`, `g${o.offset}.webp`]),
    ) as unknown as StorageListFn;
    await expect(listAllMediaNames({ pageSize: 2, maxPages: 3, list })).rejects.toThrow(/incomplete/i);
    expect((list as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(3);
  });

  it("returns normally when the ceiling page is the last, short page", async () => {
    const list = vi.fn(async (_p: string, o: { offset: number }) =>
      o.offset === 0 ? page(["a.webp", "b.webp"]) : page(["c.webp"]),
    ) as unknown as StorageListFn;
    await expect(listAllMediaNames({ pageSize: 2, maxPages: 2, list })).resolves.toEqual(["a.webp", "b.webp", "c.webp"]);
  });

  it("surfaces a storage error instead of pretending the bucket is empty", async () => {
    const list = (async () => ({ data: null, error: { message: "boom" } })) as unknown as StorageListFn;
    await expect(listAllMediaObjects({ list })).rejects.toThrow("boom");
  });
});
