import { describe, it, expect } from "vitest";
import { buildAliasMap, resolveMediaName, type AliasRow } from "@/lib/media-aliases";

/**
 * Pure mirror of the alias bookkeeping performed inside
 * public.rewrite_media_references (migration 20260817073000_media_alias_reversal):
 *
 *   1. upsert old -> new
 *   2. repoint every row whose new_name = old  ->  new
 *   3. delete the row whose old_name = new (that name is a LIVE object again)
 *   4. delete self aliases
 *
 * Keeping it here lets us assert the invariants (no cycles, no self rows, every
 * historical name resolves to the live object) without touching production data.
 */
const applyRename = (rows: AliasRow[], oldName: string, newName: string): AliasRow[] => {
  let next = rows.map((r) => ({ ...r }));
  const existing = next.find((r) => r.old_name === oldName);
  if (existing) existing.new_name = newName;
  else next.push({ old_name: oldName, new_name: newName });

  next = next.map((r) => (r.new_name === oldName ? { ...r, new_name: newName } : r));
  next = next.filter((r) => r.old_name !== newName);
  next = next.filter((r) => r.old_name !== r.new_name);
  return next;
};

const invariants = (rows: AliasRow[]) => {
  const map = buildAliasMap(rows);
  // no self rows
  expect(rows.every((r) => r.old_name !== r.new_name)).toBe(true);
  // no cycles: every chain terminates at a name that is not an alias source
  for (const row of rows) {
    const seen = new Set<string>([row.old_name]);
    let cur = row.new_name;
    while (map.has(cur)) {
      expect(seen.has(cur)).toBe(false);
      seen.add(cur);
      cur = map.get(cur)!;
    }
  }
};

describe("rewrite_media_references alias bookkeeping", () => {
  it("forward chain A→B→C collapses so every snapshot resolves to C", () => {
    let rows: AliasRow[] = [];
    rows = applyRename(rows, "a.jpg", "b.jpg");
    rows = applyRename(rows, "b.jpg", "c.webp");

    invariants(rows);
    const map = buildAliasMap(rows);
    expect(resolveMediaName("a.jpg", map)).toBe("c.webp");
    expect(resolveMediaName("b.jpg", map)).toBe("c.webp");
    expect(resolveMediaName("c.webp", map)).toBe("c.webp");
  });

  it("reverse-to-old-name (A→B→C then C→A) leaves no cycle and resolves everything to A", () => {
    let rows: AliasRow[] = [];
    rows = applyRename(rows, "a.jpg", "b.jpg");
    rows = applyRename(rows, "b.jpg", "c.webp");
    rows = applyRename(rows, "c.webp", "a.jpg");

    invariants(rows);
    const map = buildAliasMap(rows);
    // a.jpg is a live object again — it must never be an alias source.
    expect(map.has("a.jpg")).toBe(false);
    expect(resolveMediaName("a.jpg", map)).toBe("a.jpg");
    expect(resolveMediaName("b.jpg", map)).toBe("a.jpg");
    expect(resolveMediaName("c.webp", map)).toBe("a.jpg");
  });

  it("immediate swap back (A→B then B→A) clears the alias entirely", () => {
    let rows: AliasRow[] = [];
    rows = applyRename(rows, "a.jpg", "b.jpg");
    rows = applyRename(rows, "b.jpg", "a.jpg");

    invariants(rows);
    const map = buildAliasMap(rows);
    expect(resolveMediaName("a.jpg", map)).toBe("a.jpg");
    expect(resolveMediaName("b.jpg", map)).toBe("a.jpg");
  });

  it("reusing a freed name for a different file drops the stale alias", () => {
    let rows: AliasRow[] = [];
    rows = applyRename(rows, "old.jpg", "new.webp");
    // "old.jpg" is uploaded again later and then renamed away
    rows = applyRename(rows, "other.jpg", "old.jpg");

    invariants(rows);
    const map = buildAliasMap(rows);
    expect(map.has("old.jpg")).toBe(false);
    expect(resolveMediaName("other.jpg", map)).toBe("old.jpg");
  });
});
