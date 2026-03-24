import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useFadeIn } from "@/hooks/use-fade-in";

interface CircularImageCarouselProps {
  images: { src: string; alt: string }[];
  className?: string;
}

const CYCLE_DURATION = 12000;
const FADE_TIME = 5000;
const COL_OFFSETS = [0, 4000, 2200];
const FOCUS_DURATION = 10000;

// Size variations: each cell picks a random scale from this range
const SIZE_MIN = 0.82;
const SIZE_MAX = 1.18;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomSize() {
  return SIZE_MIN + Math.random() * (SIZE_MAX - SIZE_MIN);
}

const BreathingCell = ({
  images,
  delay,
  focused,
  colIndex,
  onImageChange,
  getActiveImages,
}: {
  images: { src: string; alt: string }[];
  delay: number;
  focused: boolean;
  colIndex: number;
  onImageChange: (col: number, src: string) => void;
  getActiveImages: (excludeCol: number) => Set<string>;
}) => {
  const [current, setCurrent] = useState(0);
  const [next, setNext] = useState(1);
  const [fading, setFading] = useState(false);
  const [started, setStarted] = useState(false);
  const [sizeScale, setSizeScale] = useState(() => randomSize());

  // Report initial image
  useEffect(() => {
    onImageChange(colIndex, images[0]?.src ?? "");
  }, []);

  // Pick a non-duplicate next image
  const pickNext = useCallback(
    (afterIndex: number) => {
      const active = getActiveImages(colIndex);
      // Try to find one not currently shown in other columns
      for (let offset = 1; offset <= images.length; offset++) {
        const idx = (afterIndex + offset) % images.length;
        if (!active.has(images[idx].src)) return idx;
      }
      // Fallback: just use the next one
      return (afterIndex + 1) % images.length;
    },
    [images, colIndex, getActiveImages]
  );

  useEffect(() => {
    const t = setTimeout(() => {
      setStarted(true);
      onImageChange(colIndex, images[current].src);
    }, delay);
    return () => clearTimeout(t);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    const holdTimer = setTimeout(() => {
      // Pick next image that's not a duplicate
      const nextIdx = pickNext(current);
      setNext(nextIdx);
      setFading(true);
    }, CYCLE_DURATION - FADE_TIME);
    return () => clearTimeout(holdTimer);
  }, [current, started, pickNext]);

  useEffect(() => {
    if (!fading) return;
    const fadeTimer = setTimeout(() => {
      setCurrent(next);
      onImageChange(colIndex, images[next].src);
      setSizeScale(randomSize());
      setFading(false);
    }, FADE_TIME);
    return () => clearTimeout(fadeTimer);
  }, [fading, next, images, colIndex, onImageChange]);

  const currentImg = images[current];
  const nextImg = images[next];

  // Aspect ratio varies by sizeScale (base 3/2 = 1.5)
  const aspectHeight = 2 / 3 / sizeScale; // inverted for padding-bottom trick
  const paddingBottom = `${aspectHeight * 100}%`;

  return (
    <div
      className="rounded-2xl overflow-hidden w-full relative"
      style={{
        paddingBottom,
        transition: "padding-bottom 3000ms ease-in-out",
      }}
    >
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
  const [mutedCol, setMutedCol] = useState(2); // which column is dimmed

  // Track which image src each column is currently showing
  const activeImagesRef = useRef<Map<number, string>>(new Map());

  const handleImageChange = useCallback((col: number, src: string) => {
    activeImagesRef.current.set(col, src);
  }, []);

  const getActiveImages = useCallback((excludeCol: number): Set<string> => {
    const set = new Set<string>();
    activeImagesRef.current.forEach((src, col) => {
      if (col !== excludeCol) set.add(src);
    });
    return set;
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setMutedCol((prev) => (prev + 1) % maxCols);
    }, FOCUS_DURATION);
    return () => clearInterval(interval);
  }, []);

  // Build shuffled sequences per column (long enough to cycle through)
  const sequences = useMemo(() => {
    return Array.from({ length: maxCols }, () => {
      const seq: { src: string; alt: string }[] = [];
      for (let round = 0; round < 10; round++) {
        seq.push(...shuffle(images));
      }
      return seq;
    });
  }, [images]);

  return (
    <div ref={anim.ref} style={anim.style} className={className}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 max-w-5xl mx-auto items-start">
        {sequences.map((seq, col) => (
          <div
            key={col}
            className={col === 2 ? "hidden lg:block" : col === 1 ? "hidden md:block" : ""}
          >
            <BreathingCell
              images={seq}
              delay={COL_OFFSETS[col]}
              focused={col !== mutedCol}
              colIndex={col}
              onImageChange={handleImageChange}
              getActiveImages={getActiveImages}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default CircularImageCarousel;
