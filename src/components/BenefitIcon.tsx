/**
 * Hand-drawn / pencil-sketch style SVG icons for the benefits section.
 * Stroke colour inherits `currentColor` so they follow the active theme.
 */

const shared = {
  xmlns: "http://www.w3.org/2000/svg" as const,
  width: 48,
  height: 48,
  viewBox: "0 0 48 48",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/* Pain relief — a gentle wave with a soft radiance */
const PainRelief = () => (
  <svg {...shared} className="text-primary mx-auto mb-4 opacity-70">
    {/* spine-like gentle curve */}
    <path d="M24 6c0 0-2 4-2 8s2 6 2 10-2 6-2 10 2 8 2 8" />
    {/* small radiating lines */}
    <path d="M18 18c-2-1-4-1-6 0" />
    <path d="M30 18c2-1 4-1 6 0" />
    <path d="M19 28c-2 0-4 1-5 2" />
    <path d="M29 28c2 0 4 1 5 2" />
    {/* soft dot accents */}
    <circle cx="24" cy="6" r="1" fill="currentColor" stroke="none" opacity="0.4" />
    <circle cx="24" cy="42" r="1" fill="currentColor" stroke="none" opacity="0.4" />
  </svg>
);

/* Less stress — closed eye with a calm crescent */
const LessStress = () => (
  <svg {...shared} className="text-primary mx-auto mb-4 opacity-70">
    {/* closed eye arc */}
    <path d="M12 24c0 0 5-7 12-7s12 7 12 7" />
    {/* eyelash sketches */}
    <path d="M16 19l-1-3" />
    <path d="M21 16.5l-0.5-3" />
    <path d="M27 16.5l0.5-3" />
    <path d="M32 19l1-3" />
    {/* gentle crescent moon */}
    <path d="M20 32c0-3 3-5 5-5 -1.5 0.5-2.5 2-2.5 4s1 3.5 2.5 4c-2 0-5-2-5-3" />
  </svg>
);

/* Better mobility — a flowing figure-eight / infinity loop */
const Mobility = () => (
  <svg {...shared} className="text-primary mx-auto mb-4 opacity-70">
    {/* flowing ribbon */}
    <path d="M8 24c0-6 6-10 10-10s6 4 6 10-6 10-6 10" />
    <path d="M40 24c0 6-6 10-10 10s-6-4-6-10 6-10 6-10" />
    {/* small motion lines */}
    <path d="M6 20l-2-1" />
    <path d="M6 28l-2 1" />
    <path d="M42 20l2-1" />
    <path d="M42 28l2 1" />
  </svg>
);

/* Active recovery — a spiral with upward energy */
const Recovery = () => (
  <svg {...shared} className="text-primary mx-auto mb-4 opacity-70">
    {/* upward spiral */}
    <path d="M24 40c-4 0-7-3-7-7s3-7 7-7 9 3 9 9-5 11-11 11" />
    <path d="M24 26c-2 0-3-1.5-3-3.5s1.5-3.5 3-3.5 4 1.5 4 4.5" />
    {/* upward arrow */}
    <path d="M24 19V8" />
    <path d="M20 12l4-4 4 4" />
  </svg>
);

const icons = [PainRelief, LessStress, Mobility, Recovery];

interface Props {
  index: number;
}

const BenefitIcon = ({ index }: Props) => {
  const Icon = icons[index % icons.length];
  return <Icon />;
};

export default BenefitIcon;
