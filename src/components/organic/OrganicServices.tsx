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
import { usePageImages } from "@/hooks/use-page-images";
import CurvedDivider from "@/components/CurvedDivider";
import OrganicShape from "@/components/organic/OrganicShape";
import { WHATSAPP_URL } from "@/config/contact";
import { trackWhatsAppClick } from "@/lib/analytics";
import { formatPrice } from "@/lib/format-price";
import BookingDialog from "@/components/BookingDialog";

const PROMO_COLORS: Record<string, string> = {
  amber: "bg-amber-100 text-amber-800 border-amber-200",
  rose: "bg-rose-100 text-rose-800 border-rose-200",
  emerald: "bg-emerald-100 text-emerald-800 border-emerald-200",
  blue: "bg-blue-100 text-blue-800 border-blue-200",
  purple: "bg-purple-100 text-purple-800 border-purple-200",
};

const ServiceRow = ({ title, description, duration, price, bookLabel, index, badge, badgeColor, hidePrice, hideDuration, hidePriceFrom }: {
  title: string; description: string; duration: string; price: string; bookLabel: string; index: number;
  badge?: string; badgeColor?: string;
  hidePrice?: boolean; hideDuration?: boolean; hidePriceFrom?: boolean;
}) => {
  const anim = useFadeIn(index * 0.08);
  const { t } = useI18n();
  return (
    <div ref={anim.ref} style={anim.style} className="flex flex-col md:flex-row md:items-center justify-between py-8 gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="font-display text-xl md:text-2xl mb-1.5">{title}</h2>
          {badge && (
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border animate-[pulse_3s_cubic-bezier(0.4,0,0.6,1)_infinite] ${PROMO_COLORS[badgeColor || "amber"] ?? PROMO_COLORS.amber}`}>
              {badge}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground font-body leading-relaxed max-w-xl">{description}</p>
      </div>
      <div className="flex items-center gap-6 shrink-0">
        {!hideDuration && duration && <span className="text-sm font-body text-muted-foreground">{duration}</span>}
        {!hidePrice && price && (
          <span className="text-sm font-body font-medium">{formatPrice(price, t, { hidePrefix: hidePriceFrom })}</span>
        )}
        <BookingDialog
          service={title}
          duration={duration}
          price={price}
          hidePrice={hidePrice}
          hideDuration={hideDuration}
          hidePriceFrom={hidePriceFrom}
          location="services_card"
          triggerLabel={bookLabel}
          triggerClassName="text-sm font-body border border-foreground/20 text-foreground px-5 py-2 rounded-full transition-all hover:bg-foreground hover:text-background"
        />
      </div>
    </div>
  );
};

const OrganicServices = () => {
  const { mode } = useTheme();
  const isDG = mode === "dark-gradient";
  const bgColor = (cssVar: string) => isDG ? "transparent" : `hsl(var(${cssVar}))`;
  const { t, locale } = useI18n();
  const { content: sc } = useSiteContent();
  const dbServices = useDbServices();
  const dbPromotions = useDbPromotions();
  const customCarousel = usePageImages("services_carousel");

  const defaultCarousel = [
    { src: massageArm, alt: "Arm massage" },
    { src: massageDeep, alt: "Deep tissue work" },
    { src: massageNeck, alt: "Neck massage" },
    { src: massageOil, alt: "Oil massage" },
    { src: massageShoulder, alt: "Shoulder massage" },
    { src: massageStones, alt: "Hot stone therapy" },
    { src: massageBack, alt: "Back massage" },
    { src: massageWrist, alt: "Wrist massage" },
    { src: massageFoot, alt: "Foot massage" },
  ];
  const carouselImages = customCarousel.length > 0 ? customCarousel : defaultCarousel;

  const langBadge = (p: { badge_text: string; badge_text_en: string; badge_text_ru: string }) => {
    if (locale === "en" && p.badge_text_en?.trim()) return p.badge_text_en;
    if (locale === "ru" && p.badge_text_ru?.trim()) return p.badge_text_ru;
    return p.badge_text;
  };

  const services = dbServices?.map(s => {
    const promo = dbPromotions?.find(p => p.service_id === s.id);
    return {
      title: resolveField(s, "title", locale),
      description: resolveField(s, "description", locale),
      duration: resolveField(s, "duration", locale),
      price: resolveField(s, "price", locale),
      hidePrice: s.hide_price,
      hideDuration: s.hide_duration,
      hidePriceFrom: s.hide_price_from,
      badge: promo ? langBadge(promo) : undefined,
      badgeColor: promo?.badge_color,
    };
  }) ?? t.services.items;
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
          <div className="absolute inset-0 animate-hero-breathe bg-gradient-to-r from-primary/20 via-primary/8 to-transparent" />
        </div>
        <div className="relative z-10 w-full px-6 md:px-12 lg:px-20 py-16 pb-[10vh]">
          <div className="max-w-xl" ref={heroText.ref} style={heroText.style}>
            <p className="text-xs font-body tracking-[0.3em] uppercase text-foreground/90 mb-4">
              {t.services.sectionLabel}
            </p>
            <h1 className="font-display text-4xl md:text-5xl leading-snug mb-6 text-foreground">{t.services.title}</h1>
            <p className="text-base text-foreground/70 font-body leading-[1.8] max-w-md">{t.services.pageSubtitle}</p>
          </div>
        </div>

        {/* Half-moon overlap into services section */}
        <div className="absolute bottom-0 left-0 right-0 z-20">
          <svg viewBox="0 0 1440 180" preserveAspectRatio="none" className="w-full h-[5vh] md:h-[6vh] max-h-16 block">
            <ellipse cx="720" cy="180" rx="900" ry="180" style={{ fill: bgColor("--background") }} />
          </svg>
        </div>
      </section>

      {/* Services list — editorial */}
      <section className="px-6 md:px-12 lg:px-20 py-12 md:py-16 relative overflow-hidden">
        <OrganicShape shape="ring" size="w-28 h-28" position="top-8 right-4" animation="float" borderColor="hsl(var(--primary) / 0.08)" delay={500} />
        <OrganicShape shape="circle" size="w-72 h-72 md:w-14 md:h-14" position="bottom-16 left-6" animation="breathe" color="hsl(var(--primary) / 0.05)" delay={2500} />
        <div className="max-w-5xl mx-auto">
          <div className="space-y-0 divide-y divide-border">
            {services.map((s, i) => (
              <ServiceRow key={i} {...s} bookLabel={t.services.bookBtn} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* Circular image cluster — full bleed on mobile with overlapping dividers */}
      <section className="relative">
        {/* Top curved divider — sits on top of image, filled with services-list bg */}
        <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none md:hidden">
          <svg viewBox="0 0 1440 96" preserveAspectRatio="none" className="w-full h-16 block">
            <path d="M0,0 L1440,0 L1440,96 C960,0 480,0 0,96 Z" style={{ fill: bgColor("--background") }} />
          </svg>
        </div>

        {/* Desktop top divider */}
        <div className="hidden md:block">
          <CurvedDivider from="bg-background" to="bg-secondary" />
        </div>

        <div className={`${isDG ? 'bg-transparent' : 'bg-transparent md:bg-secondary'} px-0 md:px-12 lg:px-20 py-0 md:py-20 overflow-hidden`}>
          <div className="max-w-5xl mx-auto">
            <CircularImageCarousel images={carouselImages} />
          </div>
        </div>

        {/* Bottom curved divider — sits on bottom of image, filled with CTA bg */}
        <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none md:hidden">
          <svg viewBox="0 0 1440 96" preserveAspectRatio="none" className="w-full h-16 block">
            <path d="M0,96 L1440,96 L1440,0 C960,96 480,96 0,0 Z" style={{ fill: bgColor("--organic-dark") }} />
          </svg>
        </div>

        {/* Desktop bottom divider */}
        <div className="hidden md:block">
        <div className="relative h-24 overflow-hidden" style={{ backgroundColor: bgColor("--organic-dark") }} aria-hidden="true">
            <svg viewBox="0 0 1440 96" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
              <path d="M0,96 C480,0 960,0 1440,96 L1440,0 L0,0 Z" style={{ fill: isDG ? "transparent" : "hsl(var(--secondary))" }} />
            </svg>
          </div>
        </div>
      </section>

      {/* Quiet CTA — dark to match half-moon */}
      <section className="px-6 md:px-12 lg:px-20 py-16 md:py-20" style={{ backgroundColor: bgColor("--organic-dark") }}>
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
                    onClick={() => trackWhatsAppClick("services_final_cta")}
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
