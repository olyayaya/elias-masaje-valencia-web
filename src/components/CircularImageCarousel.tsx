import { useEffect, useRef, useState, useCallback } from "react";
import { useFadeIn } from "@/hooks/use-fade-in";

interface CircularImageCarouselProps {
  images: { src: string; alt: string }[];
  className?: string;
}

const ITEM_GAP = 14;
const ITEM_HEIGHT = 200;
const SPEED = 0.35;
const SCALE_MAX = 1.416;

const CircularImageCarousel = ({ images, className = "" }: CircularImageCarouselProps) => {
  const anim = useFadeIn(0.1);
  const trackRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const rafRef = useRef<number>(0);
  const [, setTick] = useState(0);
  const [loadedWidths, setLoadedWidths] = useState<number[]>([]);

  const dupeCount = 3;
  const allImages = Array.from({ length: dupeCount }, () => images).flat();

  // Compute per-image widths from natural aspect ratios once loaded
  const itemWidths = images.map((_, i) => loadedWidths[i] || ITEM_HEIGHT * 1.5);
  const totalWidth = itemWidths.reduce((sum, w) => sum + w + ITEM_GAP, 0);

  // Build cumulative offsets for the full duped strip
  const allItemWidths = allImages.map((_, i) => itemWidths[i % images.length]);

  const handleImageLoad = useCallback(
    (index: number, e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      const aspect = img.naturalWidth / img.naturalHeight;
      const w = Math.round(ITEM_HEIGHT * aspect);
      setLoadedWidths((prev) => {
        const next = [...prev];
        next[index] = w;
        return next;
      });
    },
    []
  );

  const animate = useCallback(() => {
    offsetRef.current -= SPEED;
    if (Math.abs(offsetRef.current) >= totalWidth) {
      offsetRef.current += totalWidth;
    }
    setTick((t) => t + 1);
    rafRef.current = requestAnimationFrame(animate);
  }, [totalWidth]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate]);

  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={(node) => {
        (containerRef as any).current = node;
        if (typeof anim.ref === "function") (anim.ref as any)(node);
        else if (anim.ref) (anim.ref as any).current = node;
      }}
      style={{ ...anim.style, width: "100vw", position: "relative", left: "50%", transform: "translateX(-50%)" }}
      className={`overflow-hidden ${className}`}
    >
      <div
        ref={trackRef}
        className="flex items-center"
        style={{
          height: ITEM_HEIGHT * SCALE_MAX + 32,
          transform: `translateX(${offsetRef.current}px)`,
          willChange: "transform",
        }}
      >
        {allImages.map((img, i) => {
          const w = allItemWidths[i];

          // Compute center of this item in viewport coords
          let itemX = offsetRef.current;
          for (let j = 0; j < i; j++) itemX += allItemWidths[j] + ITEM_GAP;
          const itemCenterX = itemX + w / 2;

          const containerRect = containerRef.current?.getBoundingClientRect();
          const viewportCenter = containerRect
            ? containerRect.left + containerRect.width / 2
            : typeof window !== "undefined" ? window.innerWidth / 2 : 500;

          const dist = Math.abs(itemCenterX - viewportCenter);
          const maxDist = 500;
          const proximity = Math.max(0, 1 - dist / maxDist);
          const scale = 1 + (SCALE_MAX - 1) * proximity * proximity;
          const opacity = 0.4 + 0.6 * proximity;

          return (
            <div
              key={i}
              className="shrink-0 rounded-2xl overflow-hidden"
              style={{
                width: w,
                height: ITEM_HEIGHT,
                marginRight: ITEM_GAP,
                transform: `scale(${scale})`,
                opacity,
                transition: "transform 0.15s ease-out, opacity 0.15s ease-out",
              }}
            >
              <img
                src={img.src}
                alt={img.alt}
                className="w-full h-full object-cover"
                loading="lazy"
                draggable={false}
                onLoad={i < images.length ? (e) => handleImageLoad(i, e) : undefined}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CircularImageCarousel;
