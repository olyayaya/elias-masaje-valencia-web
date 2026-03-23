import { useEffect, useRef, useState } from "react";
import { useFadeIn } from "@/hooks/use-fade-in";

interface CircularImageCarouselProps {
  images: { src: string; alt: string }[];
  className?: string;
}

const CircularImageCarousel = ({ images, className = "" }: CircularImageCarouselProps) => {
  const anim = useFadeIn(0.1);
  const [activeIndex, setActiveIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true
  );

  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Auto-play on mobile/tablet
  useEffect(() => {
    if (isDesktop) return;
    intervalRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % images.length);
    }, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isDesktop, images.length]);

  // Desktop: static overlapping layout
  if (isDesktop) {
    return (
      <div ref={anim.ref} style={anim.style} className={`flex flex-wrap justify-center gap-0 relative ${className}`}>
        {images.map((img, i) => {
          const isCenter = i === Math.floor(images.length / 2);
          const size = isCenter ? "w-72 h-72" : "w-52 h-52";
          const offset = i === 0
            ? "-mr-4 mt-8"
            : i === images.length - 1
              ? "-ml-4 mt-12"
              : "z-10 mt-0";

          return (
            <div key={i} className={`${offset}`}>
              <div className={`${size} rounded-full overflow-hidden`}>
                <img src={img.src} alt={img.alt} className="w-full h-full object-cover" loading="lazy" />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Mobile/Tablet: decorative auto-playing carousel
  return (
    <div ref={anim.ref} style={anim.style} className={`relative ${className}`}>
      <div className="flex items-center justify-center h-52 relative">
        {images.map((img, i) => {
          const distance = i - activeIndex;
          const wrappedDistance = ((distance % images.length) + images.length) % images.length;
          const normalizedDist = wrappedDistance > images.length / 2
            ? wrappedDistance - images.length
            : wrappedDistance;

          const absDist = Math.abs(normalizedDist);
          const isActive = absDist === 0;
          const isAdjacent = absDist === 1;

          const size = isActive ? 176 : isAdjacent ? 112 : 80; // px
          const opacity = isActive ? 1 : isAdjacent ? 0.55 : 0.25;
          const zIndex = isActive ? 10 : isAdjacent ? 5 : 1;
          const xOffset = normalizedDist * 110;

          return (
            <div
              key={i}
              className="absolute rounded-full overflow-hidden"
              style={{
                width: size,
                height: size,
                transform: `translateX(${xOffset}px)`,
                opacity,
                zIndex,
                transition: "all 1.2s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              <img src={img.src} alt={img.alt} className="w-full h-full object-cover" loading="lazy" />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CircularImageCarousel;
