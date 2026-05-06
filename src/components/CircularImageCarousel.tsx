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
}

const TRANSITION_MS = 700;

const CircularImageCarousel = ({
  images,
  className = "",
  showControls = true,
  autoplayMs = 4500,
}: CircularImageCarouselProps) => {
  const anim = useFadeIn(0.1);
  const [visibleCols, setVisibleCols] = useState(1);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  // Touch / drag tracking
  const dragStartX = useRef<number | null>(null);
  const dragDelta = useRef(0);

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

  const total = images.length;
  // Duplicate first `visibleCols` images at the end for seamless looping
  const looped = total > 0 ? [...images, ...images.slice(0, visibleCols)] : [];

  // Eagerly preload only the currently-visible slides + the next batch about to scroll in.
  // Everything else stays lazy (handled by <img loading="lazy" /> below).
  useEffect(() => {
    if (total === 0) return;
    const normalized = ((index % total) + total) % total;
    const preloadCount = visibleCols + 1; // current visible + next slide
    for (let i = 0; i < preloadCount; i++) {
      const img = new Image();
      img.src = images[(normalized + i) % total].src;
    }
  }, [images, index, visibleCols, total]);

  const next = useCallback(() => setIndex((i) => i + 1), []);
  const prev = useCallback(() => setIndex((i) => i - 1), []);

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
    setPaused(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragStartX.current === null) return;
    dragDelta.current = e.clientX - dragStartX.current;
  };
  const onPointerUp = () => {
    if (dragStartX.current === null) return;
    const threshold = 50;
    if (dragDelta.current > threshold) prev();
    else if (dragDelta.current < -threshold) next();
    dragStartX.current = null;
    dragDelta.current = 0;
    setPaused(false);
  };

  const activeDot = ((index % total) + total) % total;

  if (total === 0) return null;

  return (
    <div ref={anim.ref} style={anim.style} className={className}>
      <div className="max-w-5xl mx-auto">
        <div
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
                    loading={i < visibleCols * 2 ? "eager" : "lazy"}
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
