import { describe, it, expect, vi, beforeEach } from "vitest";

const invoke = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: "t" } } }) },
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
  },
}));

import { checkMediaUsageBatch, USAGE_BATCH_LIMIT } from "@/lib/media-usage";

beforeEach(() => vi.clearAllMocks());

describe("batch usage chunking", () => {
  it("splits 1001 names into exactly 3 server calls and merges every answer", async () => {
    const names = Array.from({ length: 1001 }, (_, i) => `f${i}.webp`);
    invoke.mockImplementation((_fn: string, opts: { body: { fileNames: string[] } }) => ({
      data: { usage: Object.fromEntries(opts.body.fileNames.map((n, i) => [n, i % 2])) },
      error: null,
    }));

    const res = await checkMediaUsageBatch(names);

    expect(invoke).toHaveBeenCalledTimes(3);
    const sizes = invoke.mock.calls.map((c) => (c[1] as { body: { fileNames: string[] } }).body.fileNames.length);
    expect(sizes).toEqual([USAGE_BATCH_LIMIT, USAGE_BATCH_LIMIT, 1]);
    // No name is lost or duplicated across the chunks.
    expect(Object.keys(res.usage)).toHaveLength(1001);
    expect(res.usage["f1000.webp"]).toBe(0);
  });

  it("sends a single call when the library fits in one chunk", async () => {
    invoke.mockResolvedValue({ data: { usage: { "a.webp": 2 } }, error: null });
    const res = await checkMediaUsageBatch(["a.webp"]);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(res.usage).toEqual({ "a.webp": 2 });
  });
});
