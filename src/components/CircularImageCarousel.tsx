import { useEffect, useRef, useState } from "react";
import { useFadeIn } from "@/hooks/use-fade-in";
import { useIsMobile } from "@/hooks/use-mobile";

interface CircularImageCarouselProps {
  images: { src: string; alt: string }[];
  className?: string;
}

const CircularImageCarousel = ({ images, className = "" }: CircularImageCarouselProps) => {
  const anim = useFadeIn(0.1);
  const isMobile = useIsMobile();
  const [activeIndex, setActiveIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-play on mobile/tablet (< 1024px)
  useEffect(() => {
    if (!isMobile && window.innerWidth >= 1024) return;

    intervalRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % images.length);
    }, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isMobile, images.length]);

  // Desktop: static overlapping layout
  if (!isMobile && typeof window !== "undefined" && window.innerWidth >= 1024) {
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
            <div key={i} className={`${offset} transition-all duration-700`}>
              <div className={`${size} rounded-full overflow-hidden transition-all duration-700`}>
                <img src={img.src} alt={img.alt} className="w-full h-full object-cover" loading="lazy" />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Mobile/Tablet: auto-playing carousel with scale effect
  return (
    <div ref={anim.ref} style={anim.style} className={`relative overflow-hidden ${className}`}>
      <div className="flex items-center justify-center gap-4 py-4">
        {images.map((img, i) => {
          const distance = Math.abs(i - activeIndex);
          // Wrap-around distance
          const wrappedDistance = Math.min(distance, images.length - distance);

          const isActive = wrappedDistance === 0;
          const isAdjacent = wrappedDistance === 1;

          const scale = isActive ? 1 : isAdjacent ? 0.7 : 0.5;
          const opacity = isActive ? 1 : isAdjacent ? 0.6 : 0.3;
          const zIndex = isActive ? 10 : isAdjacent ? 5 : 1;

          // Position offset from center
          const baseOffset = (i - activeIndex) * 120;
          // Handle wrap-around visually
          let offset = baseOffset;
          if (baseOffset > (images.length * 60)) offset -= images.length * 120;
          if (baseOffset < -(images.length * 60)) offset += images.length * 120;

          return (
            <div
              key={i}
              className="absolute rounded-full overflow-hidden transition-all duration-[1200ms] ease-in-out"
              style={{
                width: isActive ? "11rem" : isAdjacent ? "7rem" : "5rem",
                height: isActive ? "11rem" : isAdjacent ? "7rem" : "5rem",
                transform: `translateX(${offset}px) scale(${scale})`,
                opacity,
                zIndex,
              }}
            >
              <img src={img.src} alt={img.alt} className="w-full h-full object-cover" loading="lazy" />
            </div>
          );
        })}
      </div>
      {/* Reserve space */}
      <div className="h-48" />
    </div>
  );
};

export default CircularImageCarousel;
