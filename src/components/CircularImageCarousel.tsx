import { useEffect, useRef, useState, useCallback } from "react";
import { useFadeIn } from "@/hooks/use-fade-in";

interface CircularImageCarouselProps {
  images: { src: string; alt: string }[];
  className?: string;
}

const ITEM_WIDTH = 240;
const ITEM_HEIGHT = 160;
const ITEM_GAP = 20;
const SCALE_MAX = 1.3;
const SPEED = 0.6; // px per frame

const CircularImageCarousel = ({ images, className = "" }: CircularImageCarouselProps) => {
  const anim = useFadeIn(0.1);
  const trackRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const rafRef = useRef<number>(0);
  const [, setTick] = useState(0);

  const dupeCount = 3;
  const allImages = Array.from({ length: dupeCount }, () => images).flat();
  const itemWidth = ITEM_WIDTH + ITEM_GAP;
  const totalWidth = images.length * itemWidth;

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

  useEffect(() => {
    const updateCenter = () => {};
    updateCenter();
    window.addEventListener("resize", updateCenter);
    return () => window.removeEventListener("resize", updateCenter);
  }, []);

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
          const itemCenterX = offsetRef.current + i * itemWidth + ITEM_WIDTH / 2;
          const containerRect = containerRef.current?.getBoundingClientRect();
          const viewportCenter = containerRect
            ? containerRect.left + containerRect.width / 2
            : typeof window !== "undefined" ? window.innerWidth / 2 : 500;

          const dist = Math.abs(itemCenterX - viewportCenter);
          const maxDist = 450;
          const proximity = Math.max(0, 1 - dist / maxDist);
          const scale = 1 + (SCALE_MAX - 1) * proximity * proximity;
          const opacity = 0.45 + 0.55 * proximity;

          return (
            <div
              key={i}
              className="shrink-0 rounded-2xl overflow-hidden"
              style={{
                width: ITEM_WIDTH,
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
                className="w-full h-full object-cover object-[center_40%]"
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
