import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useFadeIn } from "@/hooks/use-fade-in";

interface CircularImageCarouselProps {
  images: { src: string; alt: string }[];
  className?: string;
}

const CYCLE_DURATION = 6000; // total time each image is shown (including crossfade)
const FADE_TIME = 750; // single dissolve duration
const COL_OFFSETS = [0, 800, 400];
const FOCUS_DURATION = 10000;

function preloadImage(src: string) {
  const img = new Image();
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

const DissolveCell = ({
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
  const [imgLoaded, setImgLoaded] = useState(false);

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
      // Preload next image before triggering crossfade
      preloadImage(images[nextIdx].src);
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
      setFading(false);
    }, FADE_TIME);
    return () => clearTimeout(fadeTimer);
  }, [fading, next, images, colIndex, onImageChange]);

  const currentImg = images[current];
  const nextImg = images[next];

  return (
    <div className="rounded-none md:rounded-2xl overflow-hidden w-full aspect-[9/8] md:aspect-[3/2] relative">
      <img
        src={currentImg.src}
        alt={currentImg.alt}
        className="absolute inset-0 w-full h-full object-cover"
        loading="eager"
        draggable={false}
        onLoad={() => setImgLoaded(true)}
        style={{
          opacity: !started || !imgLoaded ? 0 : fading ? 0 : 1,
          transition: `opacity ${FADE_TIME}ms ease-in-out`,
          willChange: "opacity",
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
          transition: `opacity ${FADE_TIME}ms ease-in-out`,
          willChange: "opacity",
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

  // Preload all images up front so dissolves never wait on the network
  useEffect(() => {
    images.forEach((img) => preloadImage(img.src));
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
            <DissolveCell
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
