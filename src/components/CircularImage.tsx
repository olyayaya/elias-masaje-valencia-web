import { useFadeIn } from "@/hooks/use-fade-in";

interface CircularImageProps {
  src: string;
  alt: string;
  size?: "sm" | "md" | "lg";
  delay?: number;
  className?: string;
}

const sizeMap = {
  sm: "w-28 h-28 md:w-36 md:h-36",
  md: "w-40 h-40 md:w-52 md:h-52",
  lg: "w-52 h-52 md:w-72 md:h-72",
};

const CircularImage = ({ src, alt, size = "md", delay = 0, className = "" }: CircularImageProps) => {
  const anim = useFadeIn(delay);

  return (
    <div ref={anim.ref} style={anim.style} className={`${className}`}>
      <div className={`${sizeMap[size]} rounded-full overflow-hidden`}>
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    </div>
  );
};

export default CircularImage;
