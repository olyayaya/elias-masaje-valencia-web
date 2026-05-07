import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/context";
import { WHATSAPP_URL } from "@/config/contact";
import { trackWhatsAppClick } from "@/lib/analytics";
import { formatPrice } from "@/lib/format-price";

interface ServiceCardProps {
  title: string;
  description: string;
  duration: string;
  price: string;
  index?: number;
}

const ServiceCard = ({ title, description, duration, price, index = 0 }: ServiceCardProps) => {
  const { t } = useI18n();
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
      className="bg-card rounded border border-border p-6 md:p-8 flex flex-col justify-between shadow-card"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: `opacity 0.6s ease ${index * 0.15}s, transform 0.6s ease ${index * 0.15}s`,
      }}
    >
      <div>
        <h3 className="font-display text-xl md:text-2xl mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground font-body leading-relaxed mb-4">{description}</p>
        <div className="flex items-center gap-4 text-sm font-body text-muted-foreground mb-6">
          <span>{duration}</span>
          <span className="w-px h-4 bg-border" />
          <span className="font-medium text-foreground">{formatPrice(price, t)}</span>
        </div>
      </div>
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackWhatsAppClick("service_card", { service_name: title })}
        className="inline-block text-center text-sm font-body bg-primary text-primary-foreground px-5 py-2.5 rounded transition-opacity hover:opacity-90"
      >
        {t.services.bookBtn}
      </a>
    </div>
  );
};

export default ServiceCard;
