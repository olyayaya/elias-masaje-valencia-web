/**
 * Pure filtering/sorting for the Library. Everything here runs on the already-listed
 * objects — the only server round-trip the filters need is ONE batch usage lookup.
 */
import { extOf, kindOf, type MediaKind } from "./media-kind";

export type UsageState = "used" | "unused" | "unknown";
export type OptState = "optimized" | "canOptimize" | "notAnalyzed" | "unsupported";
export type SortKey = "newest" | "oldest" | "nameAsc" | "nameDesc" | "sizeAsc" | "sizeDesc";

export interface LibraryFile {
  name: string;
  size: number;
  url: string;
  created_at: string;
  mimeType?: string | null;
}

export interface MediaFilters {
  q: string;
  kind: "all" | MediaKind;
  exts: string[];
  minMB: string;
  maxMB: string;
  from: string;
  to: string;
  usage: "all" | UsageState;
  opt: "all" | OptState;
  sort: SortKey;
}

export const DEFAULT_FILTERS: MediaFilters = {
  q: "",
  kind: "all",
  exts: [],
  minMB: "",
  maxMB: "",
  from: "",
  to: "",
  usage: "all",
  opt: "all",
  sort: "newest",
};

export const isDefaultFilters = (f: MediaFilters): boolean =>
  f.q === "" && f.exts.length === 0 && f.minMB === "" && f.maxMB === "" && f.from === "" &&
  f.to === "" && f.usage === "all" && f.opt === "all" && f.sort === "newest";

const MB = 1024 * 1024;

const usageStateOf = (name: string, usage: Record<string, number> | null): UsageState => {
  if (!usage || !(name in usage)) return "unknown";
  return usage[name] > 0 ? "used" : "unused";
};

const toTime = (v: string) => {
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
};

export interface FilterContext {
  /** filename → number of live references. `null` when the batch lookup has not run. */
  usage: Record<string, number> | null;
  /** filename → known optimization state (populated as files get analyzed). */
  optimization: Record<string, OptState>;
}

export function applyFilters(
  files: LibraryFile[],
  f: MediaFilters,
  ctx: FilterContext,
): LibraryFile[] {
  const q = f.q.trim().toLowerCase();
  const min = f.minMB.trim() === "" ? null : Number(f.minMB) * MB;
  const max = f.maxMB.trim() === "" ? null : Number(f.maxMB) * MB;
  const from = f.from ? toTime(`${f.from}T00:00:00Z`) : null;
  const to = f.to ? toTime(`${f.to}T23:59:59.999Z`) : null;

  const out = files.filter((file) => {
    if (q && !file.name.toLowerCase().includes(q)) return false;
    if (f.kind !== "all" && kindOf(file) !== f.kind) return false;
    if (f.exts.length && !f.exts.includes(extOf(file.name))) return false;
    if (min !== null && !Number.isNaN(min) && file.size < min) return false;
    if (max !== null && !Number.isNaN(max) && file.size > max) return false;
    if (from !== null || to !== null) {
      const t = toTime(file.created_at);
      if (t === null) return false;
      if (from !== null && t < from) return false;
      if (to !== null && t > to) return false;
    }
    if (f.usage !== "all" && usageStateOf(file.name, ctx.usage) !== f.usage) return false;
    if (f.opt !== "all" && optStateOf(file, ctx.optimization) !== f.opt) return false;
    return true;
  });

  const byName = (a: LibraryFile, b: LibraryFile) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
  const byDate = (a: LibraryFile, b: LibraryFile) =>
    (toTime(a.created_at) ?? 0) - (toTime(b.created_at) ?? 0);

  const sorters: Record<SortKey, (a: LibraryFile, b: LibraryFile) => number> = {
    newest: (a, b) => byDate(b, a),
    oldest: byDate,
    nameAsc: byName,
    nameDesc: (a, b) => byName(b, a),
    sizeAsc: (a, b) => a.size - b.size,
    sizeDesc: (a, b) => b.size - a.size,
  };
  return out.sort(sorters[f.sort] ?? sorters.newest);
}

/** Distinct extensions present in the library, sorted for a stable multi-select. */
export function availableExtensions(files: LibraryFile[]): string[] {
  return Array.from(new Set(files.map((f) => extOf(f.name)).filter(Boolean))).sort();
}
