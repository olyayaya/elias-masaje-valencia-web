import { useEffect, useRef, useState } from "react";
import ServiceCard from "@/components/ServiceCard";
import serviceImage from "@/assets/service-detail.jpg";
import { useI18n } from "@/i18n/context";
import { useTheme } from "@/contexts/ThemeContext";
import OrganicServices from "@/components/organic/OrganicServices";

const useFadeIn = (delay = 0) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const style: React.CSSProperties = {
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(24px)",
    transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
  };
  return { ref, style };
};

const ServiciosPage = () => {
  const { t } = useI18n();
  const { theme } = useTheme();
  const heading = useFadeIn(0);
  const image = useFadeIn(0.2);

  if (theme === "organic") return <OrganicServices />;

  return (
    <div>
      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div ref={heading.ref} style={heading.style}>
              <h1 className="font-display text-4xl md:text-5xl mb-6">{t.services.title}</h1>
              <p className="text-sm text-muted-foreground font-body leading-relaxed">{t.services.pageSubtitle}</p>
            </div>
            <div ref={image.ref} style={image.style}>
              <img
                src={serviceImage}
                alt="Detalle de productos de masaje"
                className="rounded aspect-[4/3] object-cover w-full"
                loading="lazy"
                width={800}
                height={600}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="section-padding">
        <div className="container-wide">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {t.services.items.map((s, i) => (
              <ServiceCard key={i} {...s} index={i} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default ServiciosPage;
