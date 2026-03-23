interface CurvedDividerProps {
  from?: string;
  to?: string;
  flip?: boolean;
}

/**
 * Curved wave transition between two sections.
 * `from` = background color class of the section ABOVE (e.g. "bg-background")
 * `to`   = background color class of the section BELOW (e.g. "bg-secondary")
 * The container gets `from` as its bg, and the SVG curve is filled with `to`.
 */
const CurvedDivider = ({ from = "bg-background", to = "bg-secondary", flip = false }: CurvedDividerProps) => {
  // Convert bg-* to fill-* for SVG
  const fillClass = to.replace("bg-", "fill-");

  return (
    <div className={`relative h-16 md:h-24 ${from} overflow-hidden`} aria-hidden="true">
      <svg
        viewBox="0 0 1440 96"
        preserveAspectRatio="none"
        className={`absolute inset-0 w-full h-full ${flip ? "rotate-180" : ""}`}
      >
        <path
          d="M0,0 C480,96 960,96 1440,0 L1440,96 L0,96 Z"
          className={fillClass}
        />
      </svg>
    </div>
  );
};

export default CurvedDivider;
