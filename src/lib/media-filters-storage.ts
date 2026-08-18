/**
 * Versioned persistence for the Library filter bar.
 *
 * The stored payload is fully validated on read: anything unknown, stale or corrupted
 * degrades to DEFAULT_FILTERS instead of throwing. Private mode (no localStorage) is a
 * supported environment — every access is guarded.
 */
import { DEFAULT_FILTERS, isDefaultFilters, type MediaFilters, type SortKey } from "./media-filters";

export const FILTERS_STORAGE_KEY = "elias.library.filters.v1";

const KINDS = ["all", "photo", "video", "other"] as const;
const USAGES = ["all", "used", "unused", "unknown"] as const;
const OPTS = ["all", "optimized", "canOptimize", "notAnalyzed", "unsupported"] as const;
const SORTS: SortKey[] = ["newest", "oldest", "nameAsc", "nameDesc", "sizeAsc", "sizeDesc"];

export interface PersistedLibraryState {
  filters: MediaFilters;
  open: boolean;
}

const str = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback);
const enumOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

/** Number-ish text fields keep their string type but must never hold arbitrary content. */
const numText = (v: unknown): string =>
  typeof v === "string" && (v === "" || /^\d+(\.\d+)?$/.test(v)) ? v : "";

const dateText = (v: unknown): string =>
  typeof v === "string" && (v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v)) ? v : "";

export const parseFilters = (raw: string | null): PersistedLibraryState => {
  const fallback: PersistedLibraryState = { filters: DEFAULT_FILTERS, open: false };
  if (!raw) return fallback;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallback;
  }
  if (!parsed || typeof parsed !== "object") return fallback;
  const obj = parsed as Record<string, unknown>;
  if (obj.v !== 1) return fallback;
  const f = (obj.filters && typeof obj.filters === "object" ? obj.filters : {}) as Record<string, unknown>;

  return {
    filters: {
      q: str(f.q, ""),
      kind: enumOf(f.kind, KINDS, "all"),
      exts: Array.isArray(f.exts)
        ? f.exts.filter((e): e is string => typeof e === "string" && /^[a-z0-9]{1,10}$/i.test(e))
        : [],
      minMB: numText(f.minMB),
      maxMB: numText(f.maxMB),
      from: dateText(f.from),
      to: dateText(f.to),
      usage: enumOf(f.usage, USAGES, "all"),
      opt: enumOf(f.opt, OPTS, "all"),
      sort: enumOf(f.sort, SORTS, "newest"),
    },
    open: obj.open === true,
  };
};

export const loadFilters = (): PersistedLibraryState => {
  try {
    return parseFilters(localStorage.getItem(FILTERS_STORAGE_KEY));
  } catch {
    return { filters: DEFAULT_FILTERS, open: false };
  }
};

export const clearFilters = () => {
  try {
    localStorage.removeItem(FILTERS_STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
};

/**
 * Persist the current filter state. A fully default state (including a closed advanced
 * panel) is stored as *absence* of the key, so a manual Reset really leaves nothing
 * behind — and a reload starts from the defaults either way.
 */
export const saveFilters = (filters: MediaFilters, open: boolean) => {
  if (isDefaultFilters(filters) && !open) {
    clearFilters();
    return;
  }
  try {
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify({ v: 1, filters, open }));
  } catch {
    /* private mode — filters simply are not remembered */
  }
};

