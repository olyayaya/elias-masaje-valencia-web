import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/** Location state written by the LanguageSwitcher when the visitor changes language. */
type PreserveScrollState = { preserveScroll?: boolean; scrollY?: number } | null;

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
/**
 * The dashboard Library renders its whole (potentially long) list after a couple of async
 * round-trips, so it gets a longer window than the public pages.
 */
const DASHBOARD_RESTORE_WINDOW_MS = 6000;
export const restoreWindowFor = (pathname: string) =>
  pathname.startsWith("/dashboard") ? DASHBOARD_RESTORE_WINDOW_MS : RESTORE_WINDOW_MS;

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
  const { pathname, search, hash, state } = useLocation();
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

    // A language switch (ES <-> EN <-> RU) carries an explicit flag and the
    // position the visitor was reading at. Never applied on Back/Forward.
    const ls = state as PreserveScrollState;
    const languageSwitch =
      navigationType !== "POP" && !!ls?.preserveScroll && typeof ls?.scrollY === "number";

    const shouldRestore = languageSwitch || navigationType === "POP" || (first && isReload());

    if (!shouldRestore) {
      if (!first) window.scrollTo(0, 0);
      return cleanup;
    }

    const target = languageSwitch ? Math.max(0, Math.round(ls!.scrollY!)) : readSaved(key);
    if (target == null) return cleanup;
    if (languageSwitch) save(key, target);

    // Retry until the async content makes the page tall enough. Always
    // instant — a smooth technical scroll would be visible as a jump.
    let raf = 0;
    const deadline =
      (typeof performance !== "undefined" ? performance.now() : Date.now()) + restoreWindowFor(pathname);
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
  }, [pathname, search, hash, navigationType, state]);


  return null;
};

export default ScrollToTop;
