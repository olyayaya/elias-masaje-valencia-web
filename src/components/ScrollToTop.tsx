import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/* ------------------------------------------------------------------ *
 * Scroll behaviour for the SPA.
 *
 * - A plain link to another page opens at the top (instantly, no smooth
 *   technical scrolling).
 * - A reload (F5) or a Back/Forward step restores the position that page had,
 *   using a sessionStorage entry keyed by pathname + search.
 * - Async blocks (reviews, gallery, blog) grow the page after the first paint,
 *   so restoration is retried for a short while until the layout can actually
 *   reach the saved offset.
 * - Hash anchors are left alone; the browser/route handles them.
 * ------------------------------------------------------------------ */

const KEY_PREFIX = "scrollpos:";
/** How long we keep trying to reach the saved offset while content loads. */
const RESTORE_WINDOW_MS = 1500;

export const scrollKey = (pathname: string, search: string) => `${KEY_PREFIX}${pathname}${search}`;

const readSaved = (key: string): number | null => {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
};

const save = (key: string, y: number) => {
  try {
    sessionStorage.setItem(key, String(Math.round(y)));
  } catch {
    /* private mode — position simply is not remembered */
  }
};

const isReload = () => {
  try {
    const [nav] = performance.getEntriesByType?.("navigation") as PerformanceNavigationTiming[];
    return nav?.type === "reload" || nav?.type === "back_forward";
  } catch {
    return false;
  }
};

const ScrollToTop = () => {
  const { pathname, search, hash } = useLocation();
  const navigationType = useNavigationType();
  // The very first effect run is the initial load / reload of the document.
  const firstRun = useRef(true);

  useEffect(() => {
    const key = scrollKey(pathname, search);
    const first = firstRun.current;
    firstRun.current = false;

    // Persist the position of this page while the visitor reads it.
    const onScroll = () => save(key, window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", onScroll);
    window.addEventListener("beforeunload", onScroll);

    const cleanup = () => {
      // Remember where we left this page before unmounting the effect.
      onScroll();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", onScroll);
      window.removeEventListener("beforeunload", onScroll);
    };

    // Hash anchors: never interfere.
    if (hash) return cleanup;

    const shouldRestore = navigationType === "POP" || (first && isReload());

    if (!shouldRestore) {
      if (!first) window.scrollTo(0, 0);
      return cleanup;
    }

    const target = readSaved(key);
    if (target == null) return cleanup;

    // Retry until the async content makes the page tall enough. Always
    // instant — a smooth technical scroll would be visible as a jump.
    let raf = 0;
    const deadline = (typeof performance !== "undefined" ? performance.now() : Date.now()) + RESTORE_WINDOW_MS;
    const tick = () => {
      window.scrollTo(0, target);
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      if (
        Math.abs(window.scrollY - target) > 2 &&
        now < deadline &&
        typeof requestAnimationFrame === "function"
      ) {
        raf = requestAnimationFrame(tick);
      }
    };
    tick();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      cleanup();
    };
  }, [pathname, search, hash, navigationType]);


  return null;
};

export default ScrollToTop;
