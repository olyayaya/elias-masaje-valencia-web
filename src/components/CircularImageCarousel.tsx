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

// Landscape images: subtle zoom variation
const SIZE_MIN = 0.82;
const SIZE_MAX = 1.18;
// Portrait images: stronger zoom range
const PORTRAIT_SIZE_MIN = 0.72;
const PORTRAIT_SIZE_MAX = 1.22;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomSize(isPortrait: boolean) {
  const min = isPortrait ? PORTRAIT_SIZE_MIN : SIZE_MIN;
  const max = isPortrait ? PORTRAIT_SIZE_MAX : SIZE_MAX;
  return min + Math.random() * (max - min);
}

function normalize(value: number, min: number, max: number) {
  if (max <= min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

function getBreathScale(sizeValue: number, src: string) {
  const isPortrait = getIsPortrait(src);

  if (isPortrait) {
    const t = normalize(sizeValue, PORTRAIT_SIZE_MIN, PORTRAIT_SIZE_MAX);
    return 1.08 + t * 0.25; // 1.08 → 1.33 (strong reveal for portrait)
  }

  const t = normalize(sizeValue, SIZE_MIN, SIZE_MAX);
  return 1.02 + t * 0.08; // 1.02 → 1.10 (gentle for landscape)
}

/** Cache of image aspect ratios (width/height). >1 = landscape, <1 = portrait */
const aspectCache = new Map<string, number>();

function getIsPortrait(src: string): boolean {
  const ratio = aspectCache.get(src);
  return ratio !== undefined && ratio < 1;
}

function preloadAndCacheAspect(src: string) {
  if (aspectCache.has(src)) return;
  const img = new Image();
  img.onload = () => {
    aspectCache.set(src, img.naturalWidth / img.naturalHeight);
  };
  img.src = src;
}

/**
 * Build `cols` sequences of length `len` from `images`,
 * guaranteeing that no two columns share the same image at the same index.
 */
function buildSyncedSequences(
  images: { src: string; alt: string }[],
  cols: number,
  len: number
) {
  const seqs: { src: string; alt: string }[][] = Array.from({ length: cols }, () => []);

  for (let i = 0; i < len; i++) {
    const usedAtThisIndex = new Set<string>();
    for (let c = 0; c < cols; c++) {
      const candidates = images.filter((img) => !usedAtThisIndex.has(img.src));
      const pick =
        candidates.length > 0
          ? candidates[Math.floor(Math.random() * candidates.length)]
          : images[Math.floor(Math.random() * images.length)];
      seqs[c].push(pick);
      usedAtThisIndex.add(pick.src);
    }
  }

  return seqs;
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
  onImageChange: (col: number, srcs: string[]) => void;
  getActiveImages: (excludeCol: number) => Set<string>;
}) => {
  const [current, setCurrent] = useState(0);
  const [next, setNext] = useState(1);
  const [fading, setFading] = useState(false);
  const [started, setStarted] = useState(false);
  const [sizeScale, setSizeScale] = useState(() => randomSize(getIsPortrait(images[0]?.src ?? "")));

  useEffect(() => {
    onImageChange(colIndex, [images[0]?.src ?? ""]);
  }, [colIndex, images, onImageChange]);

  const pickNext = useCallback(
    (afterIndex: number) => {
      const active = getActiveImages(colIndex);
      for (let offset = 1; offset <= images.length; offset++) {
        const idx = (afterIndex + offset) % images.length;
        if (!active.has(images[idx].src)) return idx;
      }
      return (afterIndex + 1) % images.length;
    },
    [images, colIndex, getActiveImages]
  );

  useEffect(() => {
    const t = setTimeout(() => {
      setStarted(true);
      onImageChange(colIndex, [images[current].src]);
    }, delay);
    return () => clearTimeout(t);
  }, [delay, colIndex, current, images, onImageChange]);

  useEffect(() => {
    if (!started) return;
    const holdTimer = setTimeout(() => {
      const nextIdx = pickNext(current);
      setNext(nextIdx);
      onImageChange(colIndex, [images[current].src, images[nextIdx].src]);
      setFading(true);
    }, CYCLE_DURATION - FADE_TIME);
    return () => clearTimeout(holdTimer);
  }, [current, started, pickNext, colIndex, images, onImageChange]);

  useEffect(() => {
    if (!fading) return;
    const fadeTimer = setTimeout(() => {
      setCurrent(next);
      onImageChange(colIndex, [images[next].src]);
      setSizeScale(randomSize(getIsPortrait(images[next].src)));
      setFading(false);
    }, FADE_TIME);
    return () => clearTimeout(fadeTimer);
  }, [fading, next, images, colIndex, onImageChange]);

  const currentImg = images[current];
  const nextImg = images[next];

  const currentBreathScale = getBreathScale(sizeScale, currentImg.src);
  const nextBreathScale = getBreathScale(sizeScale, nextImg.src);

  const currentRestScale = Math.max(1, currentBreathScale - 0.06).toFixed(3);
  const nextRestScale = Math.max(1, nextBreathScale - 0.06).toFixed(3);

  return (
    <div className="rounded-none md:rounded-2xl overflow-hidden w-full aspect-[9/8] md:aspect-[3/2] relative">
      <img
        src={currentImg.src}
        alt={currentImg.alt}
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
        draggable={false}
        style={{
          opacity: !started ? 0 : fading ? 0 : 1,
          transform: !started
            ? `scale(${currentRestScale})`
            : fading
              ? `scale(${currentRestScale})`
              : `scale(${currentBreathScale.toFixed(3)})`,
          transition: `opacity ${fading ? FADE_TIME : 1000}ms ease-in-out, transform ${fading ? FADE_TIME : 3000}ms ease-in-out`,
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
          transform: fading
            ? `scale(${nextBreathScale.toFixed(3)})`
            : `scale(${nextRestScale})`,
          transition: `opacity ${FADE_TIME}ms ease-in-out, transform ${FADE_TIME}ms ease-in-out`,
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none rounded-2xl"
        style={{
          backgroundColor: "hsl(var(--secondary))",
          opacity: focused ? 0 : 1,
          transition: "opacity 3000ms ease-in-out",
        }}
      />
    </div>
  );
};

const CircularImageCarousel = ({ images, className = "" }: CircularImageCarouselProps) => {
  const anim = useFadeIn(0.1);
  const maxCols = 3;
  const [mutedCol, setMutedCol] = useState(2);
  const [visibleCols, setVisibleCols] = useState(1);

  useEffect(() => {
    images.forEach((img) => preloadAndCacheAspect(img.src));
  }, [images]);

  // Track visible column count via matchMedia
  useEffect(() => {
    const lgMq = window.matchMedia("(min-width: 1024px)");
    const mdMq = window.matchMedia("(min-width: 768px)");
    const update = () => {
      setVisibleCols(lgMq.matches ? 3 : mdMq.matches ? 2 : 1);
    };
    update();
    lgMq.addEventListener("change", update);
    mdMq.addEventListener("change", update);
    return () => {
      lgMq.removeEventListener("change", update);
      mdMq.removeEventListener("change", update);
    };
  }, []);

  // Track which image srcs each column is currently showing (includes both during crossfade)
  const activeImagesRef = useRef<Map<number, string[]>>(new Map());

  const handleImageChange = useCallback((col: number, srcs: string[]) => {
    activeImagesRef.current.set(col, srcs);
  }, []);

  const getActiveImages = useCallback((excludeCol: number): Set<string> => {
    const set = new Set<string>();
    activeImagesRef.current.forEach((srcs, col) => {
      if (col !== excludeCol) srcs.forEach((s) => set.add(s));
    });
    return set;
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setMutedCol((prev) => (prev + 1) % maxCols);
    }, FOCUS_DURATION);
    return () => clearInterval(interval);
  }, [maxCols]);

  const sequences = useMemo(() => {
    return buildSyncedSequences(images, maxCols, images.length * 10);
  }, [images]);

  return (
    <div ref={anim.ref} style={anim.style} className={className}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 md:gap-6 max-w-5xl mx-auto items-start">
        {sequences.map((seq, col) => (
          <div
            key={col}
            className={col === 2 ? "hidden lg:block" : col === 1 ? "hidden md:block" : ""}
          >
            <BreathingCell
              images={seq}
              delay={COL_OFFSETS[col]}
              focused={visibleCols === 1 ? true : col !== mutedCol}
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
