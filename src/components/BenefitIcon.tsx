/**
 * Hand-drawn / pencil-sketch style SVG icons for the benefits section.
 * Each icon draws itself in when it scrolls into view using a stroke-dashoffset animation.
 */

import { useEffect, useRef, useState } from "react";

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

const drawStyle = (visible: boolean, delay: number = 0): React.CSSProperties => ({
  strokeDasharray: 200,
  strokeDashoffset: visible ? 0 : 200,
  transition: `stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1) ${delay}s, opacity 0.6s ease ${delay}s`,
  opacity: visible ? 0.7 : 0,
});

const dotStyle = (visible: boolean, delay: number = 0): React.CSSProperties => ({
  opacity: visible ? 0.4 : 0,
  transition: `opacity 0.8s ease ${delay + 0.8}s`,
});

/* Pain relief — a gentle wave with a soft radiance */
const PainRelief = ({ visible }: { visible: boolean }) => (
  <svg {...shared} className="text-primary mx-auto mb-4">
    <path d="M24 6c0 0-2 4-2 8s2 6 2 10-2 6-2 10 2 8 2 8" style={drawStyle(visible)} />
    <path d="M18 18c-2-1-4-1-6 0" style={drawStyle(visible, 0.15)} />
    <path d="M30 18c2-1 4-1 6 0" style={drawStyle(visible, 0.2)} />
    <path d="M19 28c-2 0-4 1-5 2" style={drawStyle(visible, 0.25)} />
    <path d="M29 28c2 0 4 1 5 2" style={drawStyle(visible, 0.3)} />
    <circle cx="24" cy="6" r="1" fill="currentColor" stroke="none" style={dotStyle(visible, 0.1)} />
    <circle cx="24" cy="42" r="1" fill="currentColor" stroke="none" style={dotStyle(visible, 0.2)} />
  </svg>
);

/* Less stress — closed eye with a calm crescent */
const LessStress = ({ visible }: { visible: boolean }) => (
  <svg {...shared} className="text-primary mx-auto mb-4">
    <path d="M12 24c0 0 5-7 12-7s12 7 12 7" style={drawStyle(visible)} />
    <path d="M16 19l-1-3" style={drawStyle(visible, 0.15)} />
    <path d="M21 16.5l-0.5-3" style={drawStyle(visible, 0.2)} />
    <path d="M27 16.5l0.5-3" style={drawStyle(visible, 0.25)} />
    <path d="M32 19l1-3" style={drawStyle(visible, 0.3)} />
    <path d="M20 32c0-3 3-5 5-5 -1.5 0.5-2.5 2-2.5 4s1 3.5 2.5 4c-2 0-5-2-5-3" style={drawStyle(visible, 0.35)} />
  </svg>
);

/* Better mobility — a flowing figure-eight / infinity loop */
const Mobility = ({ visible }: { visible: boolean }) => (
  <svg {...shared} className="text-primary mx-auto mb-4">
    <path d="M8 24c0-6 6-10 10-10s6 4 6 10-6 10-6 10" style={drawStyle(visible)} />
    <path d="M40 24c0 6-6 10-10 10s-6-4-6-10 6-10 6-10" style={drawStyle(visible, 0.2)} />
    <path d="M6 20l-2-1" style={drawStyle(visible, 0.35)} />
    <path d="M6 28l-2 1" style={drawStyle(visible, 0.4)} />
    <path d="M42 20l2-1" style={drawStyle(visible, 0.45)} />
    <path d="M42 28l2 1" style={drawStyle(visible, 0.5)} />
  </svg>
);

/* Active recovery — a spiral with upward energy */
const Recovery = ({ visible }: { visible: boolean }) => (
  <svg {...shared} className="text-primary mx-auto mb-4">
    <path d="M24 40c-4 0-7-3-7-7s3-7 7-7 9 3 9 9-5 11-11 11" style={drawStyle(visible)} />
    <path d="M24 26c-2 0-3-1.5-3-3.5s1.5-3.5 3-3.5 4 1.5 4 4.5" style={drawStyle(visible, 0.2)} />
    <path d="M24 19V8" style={drawStyle(visible, 0.35)} />
    <path d="M20 12l4-4 4 4" style={drawStyle(visible, 0.4)} />
  </svg>
);

const iconComponents = [PainRelief, LessStress, Mobility, Recovery];

interface Props {
  index: number;
}

const BenefitIcon = ({ index }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const Icon = iconComponents[index % iconComponents.length];
  return (
    <div ref={ref}>
      <Icon visible={visible} />
    </div>
  );
};

export default BenefitIcon;
