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
};

const toHsl = (cls: string) => {
  const v = colorVar[cls];
  return v ? `hsl(${v})` : undefined;
};

const CurvedDivider = ({ from = "bg-background", to = "bg-secondary", flip = false }: CurvedDividerProps) => {
  const fromColor = toHsl(from);
  const toColor = toHsl(to);

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
