import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useFadeIn } from "@/hooks/use-fade-in";

interface CircularImageCarouselProps {
  images: { src: string; alt: string }[];
  className?: string;
}

const CYCLE_DURATION = 12000;
const FADE_TIME = 5000;
const COL_OFFSETS = [0, 4000, 2200];
const FOCUS_DURATION = 6000; // how long each column stays in focus

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
  delay,
  focused,
}: {
  images: { src: string; alt: string }[];
  delay: number;
  focused: boolean;
}) => {
  const [current, setCurrent] = useState(0);
  const [next, setNext] = useState(1);
  const [fading, setFading] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    const holdTimer = setTimeout(() => {
      setFading(true);
    }, CYCLE_DURATION - FADE_TIME);
    return () => clearTimeout(holdTimer);
  }, [current, started]);

  useEffect(() => {
    if (!fading) return;
    const fadeTimer = setTimeout(() => {
      setCurrent(next);
      setNext((next + 1) % images.length);
      setFading(false);
    }, FADE_TIME);
    return () => clearTimeout(fadeTimer);
  }, [fading, next, images.length]);

  const currentImg = images[current];
  const nextImg = images[next];

  return (
    <div className="rounded-2xl overflow-hidden w-full aspect-[3/2] relative">
      <img
        src={currentImg.src}
        alt={currentImg.alt}
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
        draggable={false}
        style={{
          opacity: !started ? 0 : fading ? 0 : 1,
          transform: !started ? "scale(0.97)" : fading ? "scale(0.97)" : "scale(1.02)",
          transition: `opacity ${fading ? FADE_TIME : 800}ms ease-in-out, transform ${fading ? FADE_TIME : 800}ms ease-in-out`,
        }}
      />
      <img
        src={nextImg.src}
        alt={nextImg.alt}
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
        draggable={false}
        style={{
          opacity: fading ? 1 : 0,
          transform: fading ? "scale(1.02)" : "scale(0.97)",
          transition: `opacity ${FADE_TIME}ms ease-in-out, transform ${FADE_TIME}ms ease-in-out`,
        }}
      />
      {/* Soft overlay for non-focal columns */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundColor: "hsl(var(--secondary))",
          opacity: focused ? 0 : 0.45,
          transition: "opacity 2000ms ease-in-out",
        }}
      />
    </div>
  );
};

const CircularImageCarousel = ({ images, className = "" }: CircularImageCarouselProps) => {
  const anim = useFadeIn(0.1);

  const maxCols = 3;

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
              delay={COL_OFFSETS[col]}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default CircularImageCarousel;
