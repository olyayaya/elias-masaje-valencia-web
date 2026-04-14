import { useTheme } from "@/contexts/ThemeContext";

interface CurvedDividerProps {
  /** Background class of the section ABOVE */
  from?: string;
  /** Background class of the section BELOW */
  to?: string;
  /** If true, curve arches upward (concave from below) */
  flip?: boolean;
}

/** Map bg-X classes to their CSS variable for inline fill */
const colorVar: Record<string, string> = {
  "bg-background": "var(--background)",
  "bg-secondary": "var(--secondary)",
  "bg-card": "var(--card)",
  "bg-muted": "var(--muted)",
  "bg-primary": "var(--primary)",
  "bg-accent": "var(--accent)",
  "bg-organic-dark": "var(--organic-dark)",
};

/**
 * In dark-gradient mode the body uses a fixed multi-stop gradient.
 * Flat-color fills for `bg-background` and `bg-secondary` create a
 * visible seam. We replace those with `transparent` so the body
 * gradient shows through seamlessly.
 */
const TRANSPARENT_IN_GRADIENT = new Set(["bg-background", "bg-secondary", "bg-organic-dark"]);

const resolveColor = (cls: string, isDarkGradient: boolean) => {
  if (isDarkGradient && TRANSPARENT_IN_GRADIENT.has(cls)) return "transparent";
  const v = colorVar[cls];
  return v ? `hsl(${v})` : undefined;
};

const CurvedDivider = ({ from = "bg-background", to = "bg-secondary", flip = false }: CurvedDividerProps) => {
  const { mode } = useTheme();
  const isDG = mode === "dark-gradient";
  const fromColor = resolveColor(from, isDG);
  const toColor = resolveColor(to, isDG);

  if (flip) {
    return (
      <div className={`relative h-16 md:h-24 overflow-hidden`} style={{ backgroundColor: toColor }} aria-hidden="true">
        <svg viewBox="0 0 1440 96" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
          <path d="M0,96 C480,0 960,0 1440,96 L1440,0 L0,0 Z" style={{ fill: fromColor }} />
        </svg>
      </div>
    );
  }

  return (
    <div className={`relative h-16 md:h-24 overflow-hidden`} style={{ backgroundColor: fromColor }} aria-hidden="true">
      <svg viewBox="0 0 1440 96" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
        <path d="M0,0 C480,96 960,96 1440,0 L1440,96 L0,96 Z" style={{ fill: toColor }} />
      </svg>
    </div>
  );
};

export default CurvedDivider;
