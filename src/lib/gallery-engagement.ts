/**
 * Views and likes for the public gallery.
 *
 * Privacy: no cookies, no fingerprinting, no IP. A visitor is a random UUID kept in
 * this browser's localStorage — nothing personal is collected or sent. The server only
 * ever receives that opaque id.
 *
 * Both writes go through SECURITY DEFINER RPCs (see the pending engagement migration).
 * The RPCs may not exist yet in a given environment, so every call degrades to
 * "local only" instead of surfacing an error to a visitor.
 */

import { supabase } from "@/integrations/supabase/client";

export const VISITOR_KEY = "eg.gallery.visitor";
export const LIKES_KEY = "eg.gallery.likes";
export const VIEWED_KEY = "eg.gallery.viewed";

const safeLocal = (): Storage | null => {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
};

const safeSession = (): Storage | null => {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
};

const randomId = () => {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `v-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
};

/** Stable random visitor id for this browser. Created on first use. */
export function getVisitorId(): string {
  const store = safeLocal();
  const existing = store?.getItem(VISITOR_KEY);
  if (existing && existing.length >= 8) return existing;
  const id = randomId();
  try {
    store?.setItem(VISITOR_KEY, id);
  } catch {
    /* private mode — the id simply lives for this page */
  }
  return id;
}

const readSet = (store: Storage | null, key: string): Set<string> => {
  try {
    const raw = store?.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : []);
  } catch {
    return new Set();
  }
};

const writeSet = (store: Storage | null, key: string, set: Set<string>) => {
  try {
    store?.setItem(key, JSON.stringify([...set]));
  } catch {
    /* quota / private mode */
  }
};

export const getLikedIds = (): Set<string> => readSet(safeLocal(), LIKES_KEY);

export const isLiked = (id: string) => getLikedIds().has(id);

export function setLikedLocally(id: string, liked: boolean) {
  const set = getLikedIds();
  if (liked) set.add(id);
  else set.delete(id);
  writeSet(safeLocal(), LIKES_KEY, set);
}

export const hasViewedInSession = (id: string) => readSet(safeSession(), VIEWED_KEY).has(id);

export function markViewedInSession(id: string) {
  const set = readSet(safeSession(), VIEWED_KEY);
  set.add(id);
  writeSet(safeSession(), VIEWED_KEY, set);
}

const callRpc = async (fn: string, args: Record<string, unknown>) => {
  // Bound call: `supabase.rpc` relies on `this`, so it must never be destructured.
  const { data, error } = await (supabase as unknown as {
    rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
  }).rpc.call(supabase, fn, args);
  if (error) throw error;
  return data;
};

/**
 * Count one view. Called only when an item is really opened in the lightbox, and at
 * most once per item per browser session.
 */
export async function registerGalleryView(id: string): Promise<boolean> {
  if (!id || hasViewedInSession(id)) return false;
  markViewedInSession(id);
  try {
    await callRpc("increment_gallery_view", { _item_id: id });
    return true;
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[gallery] view not recorded", e);
    return false;
  }
}

export interface ToggleLikeResult {
  /** True when the server accepted the change. */
  synced: boolean;
  /** Server-side like count when known. */
  likeCount?: number;
}

/** Toggle this visitor's like. The caller owns the optimistic UI and its rollback. */
export async function toggleGalleryLike(id: string, liked: boolean): Promise<ToggleLikeResult> {
  try {
    const data = await callRpc("toggle_gallery_like", {
      _item_id: id,
      _visitor_id: getVisitorId(),
      _liked: liked,
    });
    const count = typeof data === "number" ? data : (data as { like_count?: number } | null)?.like_count;
    return { synced: true, likeCount: typeof count === "number" ? count : undefined };
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[gallery] like not recorded", e);
    return { synced: false };
  }
}
