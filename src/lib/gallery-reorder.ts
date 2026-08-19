/**
 * Manual ordering helpers for the gallery.
 *
 * Both the up/down arrows and the numeric position input go through `moveIndex` +
 * `orderUpdates`, so the two controls can never disagree about what "position 3" means.
 * The resulting sort_order sequence is always 1..N — dense, unique and gap-free.
 */

export interface Orderable {
  id: string;
  sort_order: number;
}

/** Move the element at `from` to `to`, shifting everything in between. Pure. */
export function moveIndex<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  if (from < 0 || from >= next.length) return next;
  const target = Math.min(next.length - 1, Math.max(0, to));
  if (target === from) return next;
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item);
  return next;
}

/** 1-based position the admin sees and types. */
export const clampPosition = (value: number, count: number) =>
  Math.min(Math.max(1, Math.round(value) || 1), Math.max(1, count));

/**
 * Rows whose sort_order must change so the list matches `ordered` exactly.
 * Untouched rows are omitted, which keeps the write as small as the move really is.
 */
export function orderUpdates<T extends Orderable>(ordered: T[]): { id: string; sort_order: number }[] {
  const updates: { id: string; sort_order: number }[] = [];
  ordered.forEach((item, i) => {
    const next = i + 1;
    if (item.sort_order !== next) updates.push({ id: item.id, sort_order: next });
  });
  return updates;
}

/** Reordered list after moving `id` to a 1-based position. */
export function reorderTo<T extends Orderable>(items: T[], id: string, position: number): T[] {
  const from = items.findIndex((i) => i.id === id);
  if (from < 0) return items.slice();
  return moveIndex(items, from, clampPosition(position, items.length) - 1);
}

/** Reordered list after swapping `id` with its neighbour. */
export function reorderBy<T extends Orderable>(items: T[], id: string, delta: -1 | 1): T[] {
  const from = items.findIndex((i) => i.id === id);
  if (from < 0) return items.slice();
  const to = from + delta;
  if (to < 0 || to >= items.length) return items.slice();
  return moveIndex(items, from, to);
}
