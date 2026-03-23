interface CurvedDividerProps {
  from?: string;
  to?: string;
  flip?: boolean;
}

const CurvedDivider = ({ from = "bg-background", to = "bg-secondary", flip = false }: CurvedDividerProps) => (
  <div className={`relative h-16 md:h-24 ${from}`} aria-hidden="true">
    <svg
      viewBox="0 0 1440 96"
      preserveAspectRatio="none"
      className={`absolute inset-0 w-full h-full ${flip ? "rotate-180" : ""}`}
    >
      <path
        d="M0,0 C480,96 960,96 1440,0 L1440,96 L0,96 Z"
        className={to.replace("bg-", "fill-")}
      />
    </svg>
  </div>
);

export default CurvedDivider;
