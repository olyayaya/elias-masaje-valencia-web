import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Scroll-triggered parallax: returns a ref for the container
 * and a `y` value (in px) representing how far to translate the background.
 * Speed controls intensity (0.3 = image moves at 30% of scroll speed).
 */
export function useParallax(speed = 0.3) {
  const ref = useRef<HTMLElement>(null);
  const [y, setY] = useState(0);
  const ticking = useRef(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    // Only compute when element is in view
    if (rect.bottom > 0 && rect.top < vh) {
      // 0 when element top is at viewport bottom, increases as you scroll up
      const offset = (vh - rect.top) * speed;
      setY(offset);
    }
    ticking.current = false;
  }, [speed]);

  useEffect(() => {
    const onScroll = () => {
      if (!ticking.current) {
        ticking.current = true;
        requestAnimationFrame(update);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    update(); // initial
    return () => window.removeEventListener("scroll", onScroll);
  }, [update]);

  return { ref, y };
}
