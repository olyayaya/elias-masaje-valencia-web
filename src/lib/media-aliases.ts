import { supabase } from "@/integrations/supabase/client";

/**
 * Media alias map: old storage object name → the name it was renamed/re-encoded to.
 *
 * content_history snapshots are an immutable audit log — they are never rewritten. Instead,
 * every rename/format change records an alias inside the same transaction that rewrites live
 * references. Before a snapshot is restored, every media name inside it is resolved forward
 * through this map, so restoring an old version can never resurrect a deleted object name.
 */
export type AliasRow = { old_name: string; new_name: string };

export type AliasMap = Map<string, string>;

export const buildAliasMap = (rows: AliasRow[]): AliasMap =>
  new Map(rows.map((r) => [r.old_name, r.new_name]));

/**
 * Loads the alias map. Throws on any Supabase error — callers MUST NOT fall back to an
 * empty map, because an empty map silently restores stale (deleted) media names.
 */
export async function fetchAliasMap(): Promise<AliasMap> {
  const { data, error } = await supabase.from("media_aliases").select("old_name,new_name");
  if (error) throw new Error(error.message || "Failed to load media aliases");
  return buildAliasMap((data ?? []) as AliasRow[]);
}

/** Follows an A→B→C chain to the final name. Cycle-safe. */
export function resolveMediaName(name: string, map: AliasMap): string {
  let current = name;
  const seen = new Set<string>([name]);
  while (map.has(current)) {
    const next = map.get(current)!;
    if (seen.has(next)) break;
    seen.add(next);
    current = next;
  }
  return current;
}

/**
 * Rewrites every stale media name inside an arbitrary string (raw filename, full public URL,
 * or URL-encoded filename) to its current name.
 */
export function resolveMediaInText(text: string, map: AliasMap): string {
  if (!text || map.size === 0) return text;
  let out = text;
  for (const oldName of map.keys()) {
    const finalName = resolveMediaName(oldName, map);
    if (finalName === oldName) continue;
    if (out.includes(oldName)) out = out.split(oldName).join(finalName);
    const enc = encodeURIComponent(oldName);
    if (enc !== oldName && out.includes(enc)) {
      out = out.split(enc).join(encodeURIComponent(finalName));
    }
  }
  return out;
}

/** Applies resolveMediaInText to every string field of a history snapshot. */
export function resolveSnapshotMedia<T extends Record<string, unknown>>(
  snapshot: T,
  map: AliasMap,
): { snapshot: T; remapped: number } {
  if (map.size === 0) return { snapshot, remapped: 0 };
  const out: Record<string, unknown> = { ...snapshot };
  let remapped = 0;
  for (const [key, value] of Object.entries(snapshot)) {
    if (typeof value !== "string") continue;
    const next = resolveMediaInText(value, map);
    if (next !== value) {
      out[key] = next;
      remapped++;
    }
  }
  return { snapshot: out as T, remapped };
}
