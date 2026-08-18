import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useFadeIn } from "@/hooks/use-fade-in";

interface CircularImageCarouselProps {
  images: { src: string; alt: string }[];
  className?: string;
  /** Show prev/next arrows and dot indicators. Defaults to true. */
  showControls?: boolean;
  /** Autoplay interval in ms. Defaults to 4500. */
  autoplayMs?: number;
  /** Visual frame style. "card" matches the review-card rounded rectangle treatment. */
  frame?: "default" | "card";
}

const TRANSITION_MS = 700;

const CircularImageCarousel = ({
  images,
  className = "",
  showControls = true,
  autoplayMs = 4500,
  frame = "default",
}: CircularImageCarouselProps) => {
  const anim = useFadeIn(0.1);
  const [visibleCols, setVisibleCols] = useState(1);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [dataMode, setDataMode] = useState<"normal" | "reduced" | "off">("normal");
  const [nearViewport, setNearViewport] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Touch / drag tracking
  const dragStartX = useRef<number | null>(null);
  const dragDelta = useRef(0);
  const swipeIntent = useRef<"none" | "next" | "prev">("none");

  // De-duped immediate prefetch cache (kept across renders)
  const prefetched = useRef<Set<string>>(new Set());
  const prefetch = useCallback((src: string) => {
    if (!src || prefetched.current.has(src)) return;
    prefetched.current.add(src);
    const img = new Image();
    img.src = src;
  }, []);

  // Responsive column count
  useEffect(() => {
    const lgMq = window.matchMedia("(min-width: 1024px)");
    const mdMq = window.matchMedia("(min-width: 768px)");
    const update = () => setVisibleCols(lgMq.matches ? 3 : mdMq.matches ? 2 : 1);
    update();
    lgMq.addEventListener("change", update);
    mdMq.addEventListener("change", update);
    return () => {
      lgMq.removeEventListener("change", update);
      mdMq.removeEventListener("change", update);
    };
  }, []);

  // Detect prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Respect Save-Data and slow / metered connections via the Network Information API.
  // - off: 2g/slow-2g or save-data → no proactive preload, only the visible slide
  // - reduced: 3g → preload visible slides only, skip the look-ahead
  // - normal: 4g/unknown → full visible + 1 look-ahead
  useEffect(() => {
    const conn: any = (navigator as any).connection
      || (navigator as any).mozConnection
      || (navigator as any).webkitConnection;
    const update = () => {
      if (!conn) { setDataMode("normal"); return; }
      if (conn.saveData || conn.effectiveType === "slow-2g" || conn.effectiveType === "2g") {
        setDataMode("off");
      } else if (conn.effectiveType === "3g") {
        setDataMode("reduced");
      } else {
        setDataMode("normal");
      }
    };
    update();
    conn?.addEventListener?.("change", update);
    return () => conn?.removeEventListener?.("change", update);
  }, []);

  // Only preload when the carousel is near the viewport (within 600px) — keeps off-screen
  // carousels from grabbing bandwidth before the user scrolls anywhere near them.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setNearViewport(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setNearViewport(true);
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const total = images.length;
  // Duplicate first `visibleCols` images at the end for seamless looping
  const looped = total > 0 ? [...images, ...images.slice(0, visibleCols)] : [];

  // Eagerly preload only the currently-visible slides + the next batch about to scroll in.
  // Debounced so rapid skipping doesn't kick off preloads for slides the user is flying past;
  // and any preloads in-flight from a previous index get aborted (img.src cleared) so the
  // browser can cancel the network request.
  useEffect(() => {
    if (total === 0 || !nearViewport) return;
    const inFlight: HTMLImageElement[] = [];
    const debounce = setTimeout(() => {
      const normalized = ((index % total) + total) % total;
      // Tune look-ahead based on connection: off=visible only, reduced=visible only, normal=visible+1
      const preloadCount =
        dataMode === "off" ? 1
        : dataMode === "reduced" ? visibleCols
        : visibleCols + 1;
      for (let i = 0; i < preloadCount; i++) {
        const img = new Image();
        img.src = images[(normalized + i) % total].src;
        inFlight.push(img);
      }
    }, 180);
    return () => {
      clearTimeout(debounce);
      for (const img of inFlight) {
        if (!img.complete) img.src = "";
      }
    };
  }, [images, index, visibleCols, total, dataMode, nearViewport]);

  // Immediately warm the image about to scroll into view (bypasses the 180ms debounce).
  // Skip on save-data / 2g — the regular preloader will load it once it's actually visible.
  const prefetchInDirection = useCallback(
    (dir: 1 | -1) => {
      if (total === 0 || dataMode === "off") return;
      const normalized = ((index % total) + total) % total;
      const target = dir === 1
        ? (normalized + visibleCols) % total
        : (normalized - 1 + total) % total;
      prefetch(images[target].src);
    },
    [images, index, visibleCols, total, prefetch, dataMode],
  );

  const next = useCallback(() => {
    prefetchInDirection(1);
    setIndex((i) => i + 1);
  }, [prefetchInDirection]);
  const prev = useCallback(() => {
    prefetchInDirection(-1);
    setIndex((i) => i - 1);
  }, [prefetchInDirection]);

  // Autoplay — disabled when user prefers reduced motion
  useEffect(() => {
    if (paused || total === 0 || reducedMotion) return;
    const id = setInterval(next, autoplayMs);
    return () => clearInterval(id);
  }, [paused, autoplayMs, next, total, reducedMotion]);

  // Seamless loop reset: when we cross into the duplicated tail, snap back without animation
  useEffect(() => {
    if (index < total) return;
    const t = setTimeout(() => {
      const track = trackRef.current;
      if (!track) return;
      track.style.transition = "none";
      setIndex(0);
      // Force reflow then restore transition
      void track.offsetWidth;
      track.style.transition = "";
    }, TRANSITION_MS);
    return () => clearTimeout(t);
  }, [index, total]);

  // Negative index normalization (when user hits prev at 0)
  useEffect(() => {
    if (index >= 0) return;
    const t = setTimeout(() => {
      const track = trackRef.current;
      if (!track) return;
      track.style.transition = "none";
      setIndex(total - 1);
      void track.offsetWidth;
      track.style.transition = "";
    }, TRANSITION_MS);
    return () => clearTimeout(t);
  }, [index, total]);

  const slidePct = 100 / visibleCols;
  const translatePct = -(index * slidePct);

  // Drag handlers
  const onPointerDown = (e: React.PointerEvent) => {
    dragStartX.current = e.clientX;
    dragDelta.current = 0;
    swipeIntent.current = "none";
    setPaused(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragStartX.current === null) return;
    dragDelta.current = e.clientX - dragStartX.current;
    // As soon as the swipe is decisive enough, prefetch the slide entering view
    const intentThreshold = 16;
    if (swipeIntent.current === "none" && Math.abs(dragDelta.current) > intentThreshold) {
      if (dragDelta.current < 0) {
        swipeIntent.current = "next";
        prefetchInDirection(1);
      } else {
        swipeIntent.current = "prev";
        prefetchInDirection(-1);
      }
    }
  };
  const onPointerUp = () => {
    if (dragStartX.current === null) return;
    const threshold = 50;
    if (dragDelta.current > threshold) prev();
    else if (dragDelta.current < -threshold) next();
    dragStartX.current = null;
    dragDelta.current = 0;
    swipeIntent.current = "none";
    setPaused(false);
  };

  const activeDot = ((index % total) + total) % total;

  if (total === 0) return null;

  return (
    <div ref={anim.ref} style={anim.style} className={className}>
      <div className="max-w-5xl mx-auto">
        <div
          ref={containerRef}
          className="relative overflow-hidden md:rounded-2xl"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div
            ref={trackRef}
            className="flex touch-pan-y select-none"
            style={{
              transform: `translateX(${translatePct}%)`,
              transition: reducedMotion ? "none" : `transform ${TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
              willChange: "transform",
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {looped.map((img, i) => (
              <div
                key={`${img.src}-${i}`}
                className="shrink-0 px-0 md:px-3"
                style={{ width: `${slidePct}%` }}
              >
                <div className="rounded-none md:rounded-2xl overflow-hidden w-full aspect-[9/8] md:aspect-[3/2] bg-secondary">
                  <img
                    src={img.src}
                    alt={img.alt}
                    className="w-full h-full object-cover"
                    draggable={false}
                    loading={nearViewport && i >= index && i < index + visibleCols + 1 ? "eager" : "lazy"}
                    fetchPriority={nearViewport && i >= index && i < index + visibleCols ? "high" : "auto"}
                  />
                </div>
              </div>
            ))}
          </div>

          {showControls && total > visibleCols && (
            <>
              <button
                type="button"
                aria-label="Previous"
                onClick={prev}
                className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 w-11 h-11 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-background/70 backdrop-blur-sm text-foreground hover:bg-background active:bg-background transition-colors shadow-sm"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                aria-label="Next"
                onClick={next}
                className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 w-11 h-11 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-background/70 backdrop-blur-sm text-foreground hover:bg-background active:bg-background transition-colors shadow-sm"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>

        {showControls && total > 1 && (
          <div className="flex justify-center gap-1 mt-3">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className="group flex items-center justify-center h-9 w-9 -mx-0.5"
              >
                <span
                  className={`block h-1.5 rounded-full transition-all ${
                    i === activeDot ? "w-6 bg-foreground" : "w-1.5 bg-foreground/30 group-hover:bg-foreground/50"
                  }`}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CircularImageCarousel;
