import { useEffect, useRef, useState, useCallback } from "react";
import { useFadeIn } from "@/hooks/use-fade-in";

interface CircularImageCarouselProps {
  images: { src: string; alt: string }[];
  className?: string;
}

const ITEM_BASE_SIZE = 140;
const ITEM_GAP = 24;
const SCALE_MAX = 1.45;
const SPEED = 0.6; // px per frame

const CircularImageCarousel = ({ images, className = "" }: CircularImageCarouselProps) => {
  const anim = useFadeIn(0.1);
  const trackRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const rafRef = useRef<number>(0);
  const [, setTick] = useState(0);

  // Duplicate images enough to fill viewport + extra
  const dupeCount = 3;
  const allImages = Array.from({ length: dupeCount }, () => images).flat();
  const itemWidth = ITEM_BASE_SIZE + ITEM_GAP;
  const totalWidth = images.length * itemWidth;

  const animate = useCallback(() => {
    offsetRef.current -= SPEED;
    // Loop seamlessly
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
  const [containerCenter, setContainerCenter] = useState(0);

  useEffect(() => {
    const updateCenter = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerCenter(rect.left + rect.width / 2);
      }
    };
    updateCenter();
    window.addEventListener("resize", updateCenter);
    return () => window.removeEventListener("resize", updateCenter);
  }, []);

  return (
    <div
      ref={(node) => {
        // Merge refs
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
          height: ITEM_BASE_SIZE * SCALE_MAX + 24,
          transform: `translateX(${offsetRef.current}px)`,
          willChange: "transform",
        }}
      >
        {allImages.map((img, i) => {
          // Calculate this item's center x relative to viewport
          const itemCenterX = offsetRef.current + i * itemWidth + ITEM_BASE_SIZE / 2;
          const containerRect = containerRef.current?.getBoundingClientRect();
          const viewportCenter = containerRect
            ? containerRect.left + containerRect.width / 2
            : typeof window !== "undefined" ? window.innerWidth / 2 : 500;

          const dist = Math.abs(itemCenterX - viewportCenter);
          const maxDist = 400;
          const proximity = Math.max(0, 1 - dist / maxDist);
          const scale = 1 + (SCALE_MAX - 1) * proximity * proximity;
          const opacity = 0.45 + 0.55 * proximity;

          return (
            <div
              key={i}
              className="shrink-0 rounded-full overflow-hidden"
              style={{
                width: ITEM_BASE_SIZE,
                height: ITEM_BASE_SIZE,
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
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CircularImageCarousel;
