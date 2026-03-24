import massageShoulder2 from "@/assets/massage-shoulder2.jpg";
import massageNeck from "@/assets/massage-neck.jpg";
import massageWrist from "@/assets/massage-wrist.jpg";
import massageShoulder from "@/assets/massage-shoulder.jpg";
import massageArm from "@/assets/massage-arm.jpg";
import massageBack from "@/assets/massage-back.jpg";
import massageFoot from "@/assets/massage-foot.jpg";
import massageStones from "@/assets/massage-stones.jpg";
import massageDeep from "@/assets/massage-deep.jpg";
import massageOil from "@/assets/massage-oil.jpg";
import { useI18n } from "@/i18n/context";
import { useFadeIn } from "@/hooks/use-fade-in";
import { useSiteContent } from "@/hooks/use-site-content";
import { useTheme } from "@/contexts/ThemeContext";
import { useDbServices, useDbPromotions, resolveField } from "@/hooks/use-db-content";

import CircularImageCarousel from "@/components/CircularImageCarousel";
import CurvedDivider from "@/components/CurvedDivider";
import OrganicShape from "@/components/organic/OrganicShape";

const WHATSAPP_URL = "https://wa.me/34698968007?text=Hola%2C%20me%20gustaría%20reservar%20una%20cita";

const ServiceRow = ({ title, description, duration, price, bookLabel, index }: {
  title: string; description: string; duration: string; price: string; bookLabel: string; index: number;
}) => {
  const anim = useFadeIn(index * 0.08);
  return (
    <div ref={anim.ref} style={anim.style} className="flex flex-col md:flex-row md:items-center justify-between py-8 gap-4">
      <div className="flex-1">
        <h3 className="font-display text-xl md:text-2xl mb-1.5">{title}</h3>
        <p className="text-sm text-muted-foreground font-body leading-relaxed max-w-xl">{description}</p>
      </div>
      <div className="flex items-center gap-6 shrink-0">
        <span className="text-sm font-body text-muted-foreground">{duration}</span>
        <span className="text-sm font-body font-medium">{price}</span>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-body border border-foreground/20 text-foreground px-5 py-2 rounded-full transition-all hover:bg-foreground hover:text-background"
        >
          {bookLabel}
        </a>
      </div>
    </div>
  );
};

const OrganicServices = () => {
  const { theme } = useTheme();
  const { t, locale } = useI18n();
  const { content: sc } = useSiteContent();
  const dbServices = useDbServices();
  const services = dbServices?.map(s => ({
    title: resolveField(s, "title", locale),
    description: resolveField(s, "description", locale),
    duration: s.duration,
    price: s.price,
  })) ?? t.services.items;
  const heroText = useFadeIn(0.1);

  return (
    <div>
      {/* Hero — full bleed image */}
      <section className="relative min-h-[45vh] md:min-h-[55vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={massageShoulder2}
            alt="Masaje profesional"
            className="w-full h-full object-cover object-[center_85%] animate-hero-zoom"
            width={1920}
            height={1080}
          />
          <div className="absolute inset-0 animate-hero-breathe bg-background/60 md:bg-transparent md:bg-gradient-to-r md:from-background/80 md:via-background/50 md:to-transparent" />
          {theme === "clinical" && (
            <div className="absolute inset-0 animate-hero-breathe bg-gradient-to-r from-primary/30 via-primary/10 to-transparent" />
          )}
          {theme === "organic" && (
            <div className="absolute inset-0 animate-hero-breathe bg-gradient-to-r from-primary/25 via-primary/10 to-transparent" />
          )}
        </div>
        <div className="relative z-10 w-full px-6 md:px-12 lg:px-20 py-16 pb-[10vh]">
          <div className="max-w-xl" ref={heroText.ref} style={heroText.style}>
            <p className="text-xs font-body tracking-[0.3em] uppercase text-foreground/90 mb-4">
              Treatments
            </p>
            <h1 className="font-display text-4xl md:text-5xl leading-snug mb-6 text-foreground">{t.services.title}</h1>
            <p className="text-base text-foreground/70 font-body leading-[1.8] max-w-md">{t.services.pageSubtitle}</p>
          </div>
        </div>

        {/* Half-moon overlap into services section */}
        <div className="absolute bottom-0 left-0 right-0 z-20">
          <svg viewBox="0 0 1440 180" preserveAspectRatio="none" className="w-full h-[5vh] md:h-[6vh] max-h-16 block">
            <ellipse cx="720" cy="180" rx="900" ry="180" style={{ fill: "hsl(var(--background))" }} />
          </svg>
        </div>
      </section>

      {/* Services list — editorial */}
      <section className="px-6 md:px-12 lg:px-20 py-12 md:py-16 relative overflow-hidden">
        <OrganicShape shape="ring" size="w-28 h-28" position="top-8 -right-8" animation="float" borderColor="hsl(var(--primary) / 0.08)" delay={500} />
        <OrganicShape shape="circle" size="w-14 h-14" position="bottom-16 left-4" animation="breathe" color="hsl(var(--primary) / 0.05)" delay={2500} />
        <div className="max-w-5xl mx-auto">
          <div className="space-y-0 divide-y divide-border">
            {services.map((s, i) => (
              <ServiceRow key={i} {...s} bookLabel={t.services.bookBtn} index={i} />
            ))}
          </div>
        </div>
      </section>

      <CurvedDivider from="bg-background" to="bg-secondary" />

      {/* Circular image cluster */}
      <section className="bg-secondary px-6 md:px-12 lg:px-20 py-16 md:py-20 overflow-hidden">
        <div className="max-w-5xl mx-auto">
          <CircularImageCarousel
            images={[
              { src: massageArm, alt: "Arm massage" },
              { src: massageDeep, alt: "Deep tissue work" },
              { src: massageNeck, alt: "Neck massage" },
              { src: massageOil, alt: "Oil massage" },
              { src: massageShoulder, alt: "Shoulder massage" },
              { src: massageStones, alt: "Hot stone therapy" },
              { src: massageBack, alt: "Back massage" },
              { src: massageWrist, alt: "Wrist massage" },
              { src: massageFoot, alt: "Foot massage" },
            ]}
          />
        </div>
      </section>

      <CurvedDivider from="bg-secondary" to="bg-organic-dark" flip />

      {/* Quiet CTA — dark to match half-moon */}
      <section className="px-6 md:px-12 lg:px-20 py-16 md:py-20" style={{ backgroundColor: "hsl(var(--organic-dark))" }}>
        <div className="max-w-2xl mx-auto text-center">
          {(() => {
            const Cta = () => {
              const anim = useFadeIn(0);
              return (
                <div ref={anim.ref} style={anim.style}>
                  <h2 className="font-display text-3xl md:text-4xl mb-4" style={{ color: "hsl(var(--organic-dark-foreground))" }}>{sc.final_cta_title || t.finalCta.title}</h2>
                  <p className="text-sm font-body mb-8" style={{ color: "hsl(var(--organic-dark-muted))" }}>{sc.final_cta_description || t.finalCta.description}</p>
                  <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-sm font-body px-10 py-3.5 rounded-full transition-all hover:opacity-90 hover:-translate-y-0.5"
                    style={{ backgroundColor: "hsl(var(--organic-dark-foreground))", color: "hsl(var(--organic-dark))" }}
                  >
                    {sc.final_cta_button || t.finalCta.cta}
                  </a>
                </div>
              );
            };
            return <Cta />;
          })()}
        </div>
      </section>
    </div>
  );
};

export default OrganicServices;
