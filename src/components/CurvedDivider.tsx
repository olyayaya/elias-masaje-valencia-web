interface CurvedDividerProps {
  /** Background class of the section ABOVE */
  from?: string;
  /** Background class of the section BELOW */
  to?: string;
  /** If true, curve arches upward (concave from below) */
  flip?: boolean;
}

const CurvedDivider = ({ from = "bg-background", to = "bg-secondary", flip = false }: CurvedDividerProps) => {
  const fromFill = from.replace("bg-", "fill-");
  const toFill = to.replace("bg-", "fill-");

  if (flip) {
    // Curve arches upward: container is `to` color, SVG paints `from` on top arc
    return (
      <div className={`relative h-16 md:h-24 ${to} overflow-hidden`} aria-hidden="true">
        <svg viewBox="0 0 1440 96" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
          <path d="M0,96 C480,0 960,0 1440,96 L1440,0 L0,0 Z" className={fromFill} />
        </svg>
      </div>
    );
  }

  // Curve arches downward: container is `from` color, SVG paints `to` on bottom arc
  return (
    <div className={`relative h-16 md:h-24 ${from} overflow-hidden`} aria-hidden="true">
      <svg viewBox="0 0 1440 96" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
        <path d="M0,0 C480,96 960,96 1440,0 L1440,96 L0,96 Z" className={toFill} />
      </svg>
    </div>
  );
};

export default CurvedDivider;
