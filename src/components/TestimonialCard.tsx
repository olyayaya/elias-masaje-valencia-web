import { useEffect, useRef, useState } from "react";

interface TestimonialCardProps {
  quote: string;
  name: string;
  index?: number;
}

const TestimonialCard = ({ quote, name, index = 0 }: TestimonialCardProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="bg-card rounded border border-border p-6 md:p-8 shadow-card"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: `opacity 0.6s ease ${index * 0.15}s, transform 0.6s ease ${index * 0.15}s`,
      }}
    >
      <p className="text-sm text-muted-foreground font-body leading-relaxed italic mb-4">"{quote}"</p>
      <p className="text-sm font-body font-medium text-foreground">— {name}</p>
    </div>
  );
};

export default TestimonialCard;
