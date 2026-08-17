/**
 * Paginated listing of the `media` bucket root.
 *
 * A single `list({ limit: 1000 })` is NOT "every file": Storage caps a page and silently
 * truncates, which makes both the picker and collision-safe naming quietly wrong once the
 * Library grows. Everything that needs the full set goes through this helper, which walks
 * the pages with limit+offset, deduplicates by name, surfaces errors instead of swallowing
 * them, and can never loop forever.
 */

import { supabase } from "@/integrations/supabase/client";

export interface StorageObject {
  name: string;
  /** Trusted MIME reported by storage metadata (may be absent). */
  mimeType: string | null;
}

export const STORAGE_PAGE_SIZE = 100;
/** Hard stop: 200 pages x 100 = 20 000 objects — far past any realistic Library. */
export const STORAGE_MAX_PAGES = 200;

export type StorageListFn = (
  prefix: string,
  opts: { limit: number; offset: number; sortBy?: { column: string; order: string } },
) => Promise<{
  data: { name: string; metadata?: { mimetype?: string } | null }[] | null;
  error: { message?: string } | null;
}>;

export interface ListAllOptions {
  pageSize?: number;
  maxPages?: number;
  /** Injected in tests; defaults to the `media` bucket of the real client. */
  list?: StorageListFn;
}

const defaultList: StorageListFn = (prefix, opts) =>
  supabase.storage.from("media").list(prefix, opts) as unknown as ReturnType<StorageListFn>;

/**
 * Every object at the bucket root, in newest-first order.
 * Rejects with the storage error message so callers can show a real, retryable failure.
 */
export async function listAllMediaObjects(options: ListAllOptions = {}): Promise<StorageObject[]> {
  const pageSize = Math.max(1, options.pageSize ?? STORAGE_PAGE_SIZE);
  const maxPages = Math.max(1, options.maxPages ?? STORAGE_MAX_PAGES);
  const list = options.list ?? defaultList;

  const out: StorageObject[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < maxPages; page += 1) {
    const { data, error } = await list("", {
      limit: pageSize,
      offset: page * pageSize,
      sortBy: { column: "created_at", order: "desc" },
    });
    if (error) throw new Error(error.message || "Storage listing failed");
    const rows = data ?? [];
    let added = 0;
    for (const row of rows) {
      const name = row?.name;
      if (!name || name === ".emptyFolderPlaceholder") continue;
      if (seen.has(name)) continue;
      seen.add(name);
      added += 1;
      out.push({ name, mimeType: row.metadata?.mimetype ?? null });
    }
    // Last page, or a backend that keeps returning the same rows: stop either way.
    if (rows.length < pageSize) break;
    if (added === 0) break;
  }

  return out;
}

/** Convenience wrapper for collision-safe naming, which only needs the names. */
export async function listAllMediaNames(options: ListAllOptions = {}): Promise<string[]> {
  return (await listAllMediaObjects(options)).map((f) => f.name);
}
