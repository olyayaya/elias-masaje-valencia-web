import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useFadeIn } from "@/hooks/use-fade-in";

interface CircularImageCarouselProps {
  images: { src: string; alt: string }[];
  className?: string;
}

// Cycle duration per cell in ms
const CYCLE_BASE = 4500;
// Stagger between columns
const COL_OFFSETS = [0, 1500, 800];

/**
 * Shuffles array using Fisher-Yates, returns new array.
 */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Given a pool of images and the number of visible slots,
 * build an infinite sequence where no image repeats within any window of `slots` items.
 */
function buildSequence(images: { src: string; alt: string }[], slots: number, length: number) {
  const seq: { src: string; alt: string }[] = [];
  let pool = shuffle(images);
  let poolIdx = 0;

  for (let i = 0; i < length; i++) {
    // refill pool when exhausted
    if (poolIdx >= pool.length) {
      pool = shuffle(images);
      poolIdx = 0;
    }
    // pick next that doesn't collide with recent `slots` items
    let candidate = pool[poolIdx];
    const recent = seq.slice(Math.max(0, i - slots), i);
    const recentSrcs = new Set(recent.map((r) => r.src));

    if (recentSrcs.has(candidate.src)) {
      // find one that's not in recent
      const alt = pool.slice(poolIdx).find((p) => !recentSrcs.has(p.src));
      if (alt) candidate = alt;
    }

    seq.push(candidate);
    poolIdx++;
  }
  return seq;
}

const BreathingCell = ({
  images,
  cycleDuration,
  delay,
}: {
  images: { src: string; alt: string }[];
  cycleDuration: number;
  delay: number;
}) => {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const startedRef = useRef(false);

  const fadeIn = cycleDuration * 0.3;
  const hold = cycleDuration * 0.4;
  const fadeOut = cycleDuration * 0.3;

  useEffect(() => {
    // Initial delay for stagger
    const delayTimer = setTimeout(() => {
      startedRef.current = true;
      setPhase("in");
    }, delay);
    return () => clearTimeout(delayTimer);
  }, [delay]);

  useEffect(() => {
    if (!startedRef.current) return;

    if (phase === "in") {
      timerRef.current = setTimeout(() => setPhase("hold"), fadeIn);
    } else if (phase === "hold") {
      timerRef.current = setTimeout(() => setPhase("out"), hold);
    } else if (phase === "out") {
      timerRef.current = setTimeout(() => {
        setIndex((prev) => (prev + 1) % images.length);
        setPhase("in");
      }, fadeOut);
    }

    return () => clearTimeout(timerRef.current);
  }, [phase, fadeIn, hold, fadeOut, images.length]);

  const opacity = !startedRef.current
    ? 0
    : phase === "in"
    ? 1
    : phase === "hold"
    ? 1
    : 0;

  const scale = !startedRef.current
    ? 0.97
    : phase === "in"
    ? 1.02
    : phase === "hold"
    ? 1.02
    : 0.97;

  const transitionDuration =
    phase === "in" ? fadeIn : phase === "out" ? fadeOut : hold;

  const img = images[index];

  return (
    <div
      className="rounded-2xl overflow-hidden w-full aspect-[3/2]"
      style={{
        opacity,
        transform: `scale(${scale})`,
        transition: `opacity ${transitionDuration}ms ease-in-out, transform ${transitionDuration}ms ease-in-out`,
      }}
    >
      <img
        src={img.src}
        alt={img.alt}
        className="w-full h-full object-cover"
        loading="lazy"
        draggable={false}
      />
    </div>
  );
};

const CircularImageCarousel = ({ images, className = "" }: CircularImageCarouselProps) => {
  const anim = useFadeIn(0.1);

  // Desktop 3 cols, tablet 2, mobile 1
  const maxCols = 3;

  // Build sequences for each cell — enough to last a long time
  const sequences = useMemo(() => {
    return Array.from({ length: maxCols }, () =>
      buildSequence(images, maxCols, images.length * 10)
    );
  }, [images]);

  return (
    <div ref={anim.ref} style={anim.style} className={className}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 max-w-5xl mx-auto">
        {sequences.map((seq, col) => (
          <div
            key={col}
            className={col === 2 ? "hidden lg:block" : col === 1 ? "hidden md:block" : ""}
          >
            <BreathingCell
              images={seq}
              cycleDuration={CYCLE_BASE + col * 400}
              delay={COL_OFFSETS[col]}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default CircularImageCarousel;
