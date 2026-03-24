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

// Landscape images: subtle size variation
const SIZE_MIN = 0.82;
const SIZE_MAX = 1.18;
// Portrait images: dramatic — start horizontal, grow to near-full height
const PORTRAIT_SIZE_MIN = 0.72; // starts slightly cropped
const PORTRAIT_SIZE_MAX = 1.22; // grows moderately taller

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
      const pick = candidates.length > 0
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

  // Report initial image
  useEffect(() => {
    onImageChange(colIndex, [images[0]?.src ?? ""]);
  }, []);

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
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    const holdTimer = setTimeout(() => {
      const nextIdx = pickNext(current);
      setNext(nextIdx);
      // During crossfade both images are visible — report both
      onImageChange(colIndex, [images[current].src, images[nextIdx].src]);
      setFading(true);
    }, CYCLE_DURATION - FADE_TIME);
    return () => clearTimeout(holdTimer);
  }, [current, started, pickNext]);

  useEffect(() => {
    if (!fading) return;
    const fadeTimer = setTimeout(() => {
      setCurrent(next);
      // Crossfade done — only the new image is visible
      onImageChange(colIndex, [images[next].src]);
      setSizeScale(randomSize(getIsPortrait(images[next].src)));
      setFading(false);
    }, FADE_TIME);
    return () => clearTimeout(fadeTimer);
  }, [fading, next, images, colIndex, onImageChange]);

  const currentImg = images[current];
  const nextImg = images[next];

  const aspectHeight = 2 / 3 / sizeScale;
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
  const [mutedCol, setMutedCol] = useState(2);

  // Preload all images to detect portrait vs landscape
  useEffect(() => {
    images.forEach((img) => preloadAndCacheAspect(img.src));
  }, [images]);

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
  }, []);

  // Build sequences guaranteeing no duplicate at same position across columns
  const sequences = useMemo(() => {
    return buildSyncedSequences(images, maxCols, images.length * 10);
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
