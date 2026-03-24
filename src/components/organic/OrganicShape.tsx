/**
 * Decorative animated shapes for the Organic Editorial theme.
 * Subtle breathing / drifting / floating movement to add life to sections.
 * All shapes are purely decorative (aria-hidden) and use pointer-events-none.
 */

interface OrganicShapeProps {
  /** Shape variant */
  shape?: "circle" | "ring" | "blob" | "arc";
  /** CSS size (w & h for circle/ring/blob, w for arc) */
  size?: string;
  /** Tailwind position classes, e.g. "-bottom-6 -right-6" */
  position?: string;
  /** Animation style */
  animation?: "breathe" | "float" | "drift";
  /** Custom color — should use CSS var, e.g. "hsl(var(--primary) / 0.08)" */
  color?: string;
  /** Border color for ring shape */
  borderColor?: string;
  /** Extra className */
  className?: string;
  /** Animation delay in ms */
  delay?: number;
}

const OrganicShape = ({
  shape = "circle",
  size = "w-20 h-20",
  position = "",
  animation = "breathe",
  color = "hsl(var(--primary) / 0.06)",
  borderColor = "hsl(var(--primary) / 0.12)",
  className = "",
  delay = 0,
}: OrganicShapeProps) => {
  const animClass =
    animation === "breathe"
      ? "animate-organic-breathe"
      : animation === "float"
      ? "animate-organic-float"
      : "animate-organic-drift";

  const delayStyle = delay ? { animationDelay: `${delay}ms` } : {};

  if (shape === "ring") {
    return (
      <div
        aria-hidden
        className={`absolute rounded-full border pointer-events-none ${size} ${position} ${animClass} ${className}`}
        style={{ borderColor, backgroundColor: "transparent", ...delayStyle }}
      />
    );
  }

  if (shape === "blob") {
    return (
      <div
        aria-hidden
        className={`absolute pointer-events-none ${size} ${position} ${animClass} ${className}`}
        style={{ ...delayStyle }}
      >
        <svg viewBox="0 0 200 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M 45,-10 C 80,10 120,-5 140,25 C 160,55 175,85 160,115 C 145,145 120,170 85,165 C 50,160 20,140 10,110 C 0,80 10,-30 45,-10 Z"
            fill={color}
          />
        </svg>
      </div>
    );
  }

  if (shape === "arc") {
    return (
      <div
        aria-hidden
        className={`absolute pointer-events-none ${size} ${position} ${animClass} ${className}`}
        style={{ ...delayStyle }}
      >
        <svg viewBox="0 0 120 60" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M 10,55 Q 60,-10 110,55"
            fill="none"
            stroke={borderColor}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  }

  // Default: circle
  return (
    <div
      aria-hidden
      className={`absolute rounded-full pointer-events-none ${size} ${position} ${animClass} ${className}`}
      style={{ backgroundColor: color, ...delayStyle }}
    />
  );
};

export default OrganicShape;
