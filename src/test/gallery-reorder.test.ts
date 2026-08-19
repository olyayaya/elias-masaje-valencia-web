import { describe, it, expect } from "vitest";
import {
  clampPosition,
  moveIndex,
  orderUpdates,
  reorderBy,
  reorderTo,
} from "@/lib/gallery-reorder";

const list = () => [
  { id: "a", sort_order: 1 },
  { id: "b", sort_order: 2 },
  { id: "c", sort_order: 3 },
  { id: "d", sort_order: 4 },
];

describe("gallery reorder", () => {
  it("swaps an item with its neighbour", () => {
    expect(reorderBy(list(), "c", -1).map((i) => i.id)).toEqual(["a", "c", "b", "d"]);
    expect(reorderBy(list(), "a", 1).map((i) => i.id)).toEqual(["b", "a", "c", "d"]);
  });

  it("is a no-op at the edges", () => {
    expect(reorderBy(list(), "a", -1).map((i) => i.id)).toEqual(["a", "b", "c", "d"]);
    expect(reorderBy(list(), "d", 1).map((i) => i.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("moves to an explicit 1-based position and shifts the rest", () => {
    expect(reorderTo(list(), "d", 1).map((i) => i.id)).toEqual(["d", "a", "b", "c"]);
    expect(reorderTo(list(), "a", 3).map((i) => i.id)).toEqual(["b", "c", "a", "d"]);
  });

  it("clamps out-of-range positions instead of dropping rows", () => {
    expect(clampPosition(0, 4)).toBe(1);
    expect(clampPosition(99, 4)).toBe(4);
    expect(reorderTo(list(), "a", 99).map((i) => i.id)).toEqual(["b", "c", "d", "a"]);
  });

  it("produces a dense 1..N sequence with no duplicates or gaps", () => {
    const next = reorderTo(
      [
        { id: "a", sort_order: 5 },
        { id: "b", sort_order: 9 },
        { id: "c", sort_order: 40 },
      ],
      "c",
      1,
    );
    const updates = orderUpdates(next);
    expect(updates).toEqual([
      { id: "c", sort_order: 1 },
      { id: "a", sort_order: 2 },
      { id: "b", sort_order: 3 },
    ]);
    const positions = updates.map((u) => u.sort_order);
    expect(new Set(positions).size).toBe(positions.length);
  });

  it("writes only the rows whose position really changed", () => {
    expect(orderUpdates(list())).toEqual([]);
  });

  it("moveIndex is pure", () => {
    const source = list();
    moveIndex(source, 0, 2);
    expect(source.map((i) => i.id)).toEqual(["a", "b", "c", "d"]);
  });
});
