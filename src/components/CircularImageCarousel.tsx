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

  // Auto-play always (slow on desktop, moderate on mobile)
  useEffect(() => {
    const interval = isDesktop ? 4000 : 3000;
    intervalRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % images.length);
    }, interval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isDesktop, images.length]);

  // Helper: get image at wrapped index
  const getImage = (offset: number) => {
    const idx = ((activeIndex + offset) % images.length + images.length) % images.length;
    return images[idx];
  };

  // Desktop: 3 visible circles, center largest, auto-rotating
  if (isDesktop) {
    const visible = [
      { img: getImage(0), size: "w-52 h-52", offset: "-mr-4 mt-8" },
      { img: getImage(1), size: "w-72 h-72", offset: "z-10 mt-0" },
      { img: getImage(2), size: "w-52 h-52", offset: "-ml-4 mt-12" },
    ];

    return (
      <div ref={anim.ref} style={anim.style} className={`flex justify-center items-start gap-0 relative w-screen left-1/2 -translate-x-1/2 ${className}`}>
        {visible.map((item, i) => (
          <div key={`${activeIndex}-${i}`} className={`${item.offset}`}>
            <div
              className={`${item.size} rounded-full overflow-hidden`}
              style={{
                animation: "fade-in 0.8s ease-out both",
              }}
            >
              <img src={item.img.src} alt={item.img.alt} className="w-full h-full object-cover" loading="lazy" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Mobile/Tablet: decorative auto-playing carousel with scale
  return (
    <div ref={anim.ref} style={anim.style} className={`relative w-screen left-1/2 -translate-x-1/2 ${className}`}>
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
          const isVisible = absDist <= 2;

          if (!isVisible) return null;

          const size = isActive ? 176 : isAdjacent ? 112 : 72;
          const opacity = isActive ? 1 : isAdjacent ? 0.55 : 0.25;
          const zIndex = isActive ? 10 : isAdjacent ? 5 : 1;
          const xOffset = normalizedDist * 100;

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
