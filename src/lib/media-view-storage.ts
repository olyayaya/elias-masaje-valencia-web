/**
 * Versioned persistence for the Library view preference (list vs. tiles, tile size).
 *
 * Mirrors the filter-storage contract: every read is validated and every access is
 * guarded, so private mode simply means "not remembered" instead of a thrown error.
 */

export type LibraryView = "list" | "grid";
export type GridSize = "s" | "m" | "l";

export interface LibraryViewState {
  view: LibraryView;
  size: GridSize;
}

export const VIEW_STORAGE_KEY = "elias.library.view.v1";

export const DEFAULT_VIEW: LibraryViewState = { view: "list", size: "m" };

const VIEWS: LibraryView[] = ["list", "grid"];
const SIZES: GridSize[] = ["s", "m", "l"];

export const parseView = (raw: string | null): LibraryViewState => {
  if (!raw) return DEFAULT_VIEW;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_VIEW;
  }
  if (!parsed || typeof parsed !== "object") return DEFAULT_VIEW;
  const obj = parsed as Record<string, unknown>;
  if (obj.v !== 1) return DEFAULT_VIEW;
  return {
    view: VIEWS.includes(obj.view as LibraryView) ? (obj.view as LibraryView) : DEFAULT_VIEW.view,
    size: SIZES.includes(obj.size as GridSize) ? (obj.size as GridSize) : DEFAULT_VIEW.size,
  };
};

export const loadView = (): LibraryViewState => {
  try {
    return parseView(localStorage.getItem(VIEW_STORAGE_KEY));
  } catch {
    return DEFAULT_VIEW;
  }
};

export const saveView = (state: LibraryViewState) => {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify({ v: 1, ...state }));
  } catch {
    /* private mode — the view preference is simply not remembered */
  }
};
