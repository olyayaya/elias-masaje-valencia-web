import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useDbServices, useDbFaqs, useDbTestimonials, resolveField } from "@/hooks/use-db-content";
import { Link } from "react-router-dom";
import heroImageOrganic from "@/assets/hero-organic.jpg";

import aboutPortrait from "@/assets/about-portrait.jpg";
import massageNeck from "@/assets/massage-neck.jpg";
import massageWrist from "@/assets/massage-wrist.jpg";
import massageShoulder from "@/assets/massage-shoulder.jpg";
import massageArm from "@/assets/massage-arm.jpg";
import massageBack from "@/assets/massage-back.jpg";
import massageFoot from "@/assets/massage-foot.jpg";
import massageStones from "@/assets/massage-stones.jpg";
import massageDeep from "@/assets/massage-deep.jpg";
import massageOil from "@/assets/massage-oil.jpg";
import interiorImage from "@/assets/interior.jpg";
import locationBg from "@/assets/location-bg.jpg";
import locationStones from "@/assets/location-stones.jpg";
import { useI18n } from "@/i18n/context";
import { formatPrice } from "@/lib/format-price";
import { useFadeIn } from "@/hooks/use-fade-in";
import { useSiteContent } from "@/hooks/use-site-content";
import CircularImage from "@/components/CircularImage";
import CircularImageCarousel from "@/components/CircularImageCarousel";
import { usePageImages } from "@/hooks/use-page-images";
import CurvedDivider from "@/components/CurvedDivider";
import FaqAccordion from "@/components/FaqAccordion";
import MapBlock from "@/components/MapBlock";
import OrganicShape from "@/components/organic/OrganicShape";
import BenefitIcon from "@/components/BenefitIcon";
import { WHATSAPP_URL } from "@/config/contact";
import { trackWhatsAppClick } from "@/lib/analytics";

const OrganicHome = () => {
  const { t, locale } = useI18n();
  const { mode } = useTheme();
  const isDG = mode === "dark-gradient";
  const heroText = useFadeIn(0.2);
  const benefitsTitle = useFadeIn(0);
  const servicesTitle = useFadeIn(0);
  const storyText = useFadeIn(0);
  const storyImg = useFadeIn(0.15);
  const testimonialsTitle = useFadeIn(0);
  const ctaBlock = useFadeIn(0);

  const dbServices = useDbServices();
  const dbFaqs = useDbFaqs();
  const dbTestimonials = useDbTestimonials();
  const { content: sc } = useSiteContent();
  const customHomeCarousel = usePageImages("home_carousel");
  const defaultHomeCarousel = [
    { src: massageWrist, alt: "Wrist massage" },
    { src: massageBack, alt: "Back massage" },
    { src: massageNeck, alt: "Neck massage" },
    { src: massageStones, alt: "Hot stone therapy" },
    { src: massageShoulder, alt: "Shoulder massage" },
    { src: massageDeep, alt: "Deep tissue work" },
    { src: massageOil, alt: "Oil massage" },
    { src: massageArm, alt: "Arm massage" },
    { src: massageFoot, alt: "Foot massage" },
  ];
  const homeCarouselImages = customHomeCarousel.length > 0 ? customHomeCarousel : defaultHomeCarousel;

  /** Resolve a CSS color; returns "transparent" in dark-gradient mode for seamless bg */
  const bgColor = (cssVar: string) => isDG ? "transparent" : `hsl(var(${cssVar}))`;
  const solidBgColor = (cssVar: string) => `hsl(var(${cssVar}))`;

  

  const services = useMemo(() =>
    dbServices?.map(s => ({
      title: resolveField(s, "title", locale),
      description: resolveField(s, "description", locale),
      duration: resolveField(s, "duration", locale),
      price: resolveField(s, "price", locale),
      hidePrice: s.hide_price,
      hideDuration: s.hide_duration,
      hidePriceFrom: s.hide_price_from,
    })) ?? t.services.items.map(s => ({ ...s, hidePrice: false, hideDuration: false, hidePriceFrom: false })),
    [dbServices, t.services.items, locale]
  );

  const faqItems = useMemo(() =>
    dbFaqs?.map(f => ({ question: resolveField(f, "question", locale), answer: resolveField(f, "answer", locale) })) ?? t.faq.items,
    [dbFaqs, t.faq.items, locale]
  );

  const testimonialItems = useMemo(() =>
    dbTestimonials?.map(tt => ({ quote: resolveField(tt, "quote", locale), name: tt.name, source: tt.source })) ?? t.testimonials.items,
    [dbTestimonials, t.testimonials.items, locale]
  );

  const previewServices = services.slice(0, 3);

  return (
    <div>
      {/* ═══════════ EDITORIAL HERO — Split layout ═══════════ */}
      <section className="relative min-h-[85vh] md:min-h-[92vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroImageOrganic}
            alt="Masaje profesional"
            className="w-full h-full object-cover object-bottom animate-hero-zoom"
            width={1920}
            height={1080}
            loading="eager"
            fetchPriority="high"
          />
          <div className="absolute inset-0 animate-hero-breathe bg-gradient-to-r from-background/95 via-background/80 to-background/40 md:from-background/80 md:via-background/50 md:to-transparent" />
          <div className="absolute inset-0 animate-hero-breathe bg-gradient-to-r from-primary/20 via-primary/8 to-transparent" />
        </div>

        <div className="relative z-10 w-full px-6 md:px-12 lg:px-20 pt-40 md:pt-20 pb-[18vh] md:pb-[20vh]">
            <div className="max-w-xl" ref={heroText.ref} style={{ ...heroText.style, textShadow: "0 2px 18px hsl(var(--background) / 0.65)" }}>
            <p className="text-xs font-body tracking-[0.3em] uppercase text-foreground/70 mb-6">
              {t.hero.tagline}
            </p>
            <h1 className="font-display text-4xl md:text-5xl lg:text-[3.5rem] leading-[1.15] mb-6 whitespace-pre-line">
              {sc.hero_headline || t.hero.headline}
            </h1>
            <p className="text-base md:text-lg text-foreground/60 font-body leading-relaxed mb-10 max-w-md">
              {sc.hero_subheadline || t.hero.subheadline}
            </p>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackWhatsAppClick("home_hero")}
              className="inline-block text-sm font-body bg-foreground text-background px-8 py-3.5 rounded-full transition-all hover:opacity-90 hover:-translate-y-0.5"
            >
              {sc.hero_cta || t.hero.cta}
            </a>
          </div>
        </div>

        {/* Half-moon overlap into benefits section */}
        <div className="absolute bottom-0 left-0 right-0 z-20">
          <svg viewBox="0 0 1440 180" preserveAspectRatio="none" className="w-full h-[6vh] md:h-[8vh] max-h-20 block">
            <ellipse cx="720" cy="180" rx="900" ry="180" style={{ fill: bgColor("--organic-dark") }} />
          </svg>
        </div>
      </section>

      {/* ═══════════ BENEFITS — Dark section ═══════════ */}
      <section className="-mt-2 relative z-20 px-6 md:px-12 lg:px-20 pt-8 md:pt-12 pb-20 md:pb-28 overflow-hidden" style={{ backgroundColor: bgColor("--organic-dark") }}>
        <OrganicShape shape="ring" size="w-32 h-32" position="top-12 right-4" animation="drift" color="transparent" borderColor="hsl(var(--organic-dark-foreground) / 0.08)" delay={1000} />
        <OrganicShape shape="circle" size="w-16 h-16" position="bottom-20 left-8" animation="breathe" color="hsl(var(--primary) / 0.06)" delay={3000} />
        <div className="max-w-5xl mx-auto">
          <div ref={benefitsTitle.ref} style={benefitsTitle.style} className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl mb-3" style={{ color: "hsl(var(--organic-dark-foreground))" }}>{t.benefits.title}</h2>
            <div className="w-12 h-px mx-auto" style={{ backgroundColor: "hsl(var(--primary))" }} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-12">
            {t.benefits.items.map((b, i) => {
              const BenefitItem = () => {
                const anim = useFadeIn(i * 0.1);
                return (
                   <div ref={anim.ref} style={anim.style} className="flex gap-5">
                    <div className="shrink-0 mt-1 animate-organic-breathe" style={{ color: "hsl(var(--organic-dark-foreground))" }}>
                      <BenefitIcon index={i} />
                    </div>
                    <div>
                      <h3 className="font-display text-xl mb-1.5" style={{ color: "hsl(var(--organic-dark-foreground))" }}>{b.title}</h3>
                      <p className="text-sm font-body leading-relaxed" style={{ color: "hsl(var(--organic-dark-muted))" }}>{b.description}</p>
                    </div>
                  </div>
                );
              };
              return <BenefitItem key={i} />;
            })}
          </div>
        </div>
      </section>

      <CurvedDivider from="bg-organic-dark" to="bg-secondary" />

      {/* ═══════════ SERVICES — Circular images + editorial list ═══════════ */}
      <section className={`${isDG ? '' : 'bg-secondary'} px-6 md:px-12 lg:px-20 py-20 md:py-28 overflow-hidden relative pb-0 md:pb-28`}>
        <OrganicShape shape="blob" size="w-40 h-40" position="top-4 right-4" animation="float" color="hsl(var(--primary) / 0.04)" delay={500} />
        <OrganicShape shape="arc" size="w-24 h-12" position="bottom-32 left-4" animation="drift" borderColor="hsl(var(--primary) / 0.1)" delay={2000} />
        <div className="max-w-6xl mx-auto">
          <div ref={servicesTitle.ref} style={servicesTitle.style} className="mb-16">
            <h2 className="font-display text-3xl md:text-4xl mb-2">{t.services.title}</h2>
            <p className="text-sm text-muted-foreground font-body max-w-md">{t.services.pageSubtitle}</p>
          </div>

          {/* Service list — editorial layout */}
          <div className="space-y-0 divide-y divide-border mb-16">
            {previewServices.map((s, i) => {
              const ServiceRow = () => {
                const anim = useFadeIn(i * 0.1);
                return (
                  <div ref={anim.ref} style={anim.style} className="flex flex-col md:flex-row md:items-center justify-between py-8 gap-4">
                    <div className="flex-1">
                      <h3 className="font-display text-xl md:text-2xl mb-1">{s.title}</h3>
                      <p className="text-sm text-muted-foreground font-body leading-relaxed max-w-lg">{s.description}</p>
                    </div>
                    <div className="flex items-center gap-6 shrink-0">
                      {!(s as any).hideDuration && s.duration && (
                        <span className="text-sm font-body text-muted-foreground">{s.duration}</span>
                      )}
                      {!(s as any).hidePrice && s.price && (
                        <span className="text-sm font-body font-medium">{formatPrice(s.price, t, { hidePrefix: (s as any).hidePriceFrom })}</span>
                      )}
                      <a
                        href={WHATSAPP_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => trackWhatsAppClick("home_service_card", { service_name: (s as any).title })}
                        className="text-sm font-body border border-foreground/20 text-foreground px-5 py-2 rounded-full transition-all hover:bg-foreground hover:text-background"
                      >
                        {t.services.bookBtn}
                      </a>
                    </div>
                  </div>
                );
              };
              return <ServiceRow key={i} />;
            })}
          </div>

          <div className="text-center mb-16">
            <Link to="/servicios" className="text-sm font-body text-primary hover:opacity-80 transition-opacity">
              {t.services.viewAll}
            </Link>
          </div>

          {/* Circular image cluster — full bleed on mobile, padded on desktop */}
          <div className="-mx-6 md:mx-0">
            <CircularImageCarousel images={homeCarouselImages} />
          </div>
        </div>

        {/* Mobile: curved divider overlays bottom of gallery image */}
        <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none md:hidden">
          <svg viewBox="0 0 1440 96" preserveAspectRatio="none" className="w-full h-16 block">
            <path d="M0,96 L1440,96 L1440,0 C960,96 480,96 0,0 Z" style={{ fill: bgColor("--organic-dark") }} />
          </svg>
        </div>
      </section>

      {/* Desktop: standard curved divider */}
      <div className="hidden md:block">
        <CurvedDivider from="bg-secondary" to="bg-organic-dark" flip />
      </div>

      {/* ═══════════ STORY — Dark editorial section ═══════════ */}
      <section className="px-6 md:px-12 lg:px-20 py-20 md:py-28" style={{ backgroundColor: bgColor("--organic-dark") }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
            <div className="md:col-span-5 md:col-start-1" ref={storyText.ref} style={storyText.style}>
              <p className="text-xs font-body tracking-[0.3em] uppercase mb-4" style={{ color: "hsl(var(--organic-dark-muted))" }}>
                {t.about.title}
              </p>
              <h2 className="font-display text-3xl md:text-4xl mb-6 leading-snug" style={{ color: "hsl(var(--organic-dark-foreground))" }}>
                {t.about.title}
              </h2>
              <p className="text-base font-body leading-[1.8] mb-4" style={{ color: "hsl(var(--organic-dark-muted))" }}>
                {sc.about_preview_p1 || t.about.previewP1}
              </p>
              <p className="text-base font-body leading-[1.8] mb-8" style={{ color: "hsl(var(--organic-dark-muted))" }}>
                {sc.about_preview_p2 || t.about.previewP2}
              </p>
              <Link
                to="/sobre-mi"
                className="text-sm font-body pb-0.5 transition-colors"
                style={{ color: "hsl(var(--organic-dark-foreground))", borderBottom: "1px solid hsl(var(--organic-dark-foreground) / 0.3)" }}
              >
                {t.about.learnMore}
              </Link>
            </div>

            <div className="md:col-span-6 md:col-start-7" ref={storyImg.ref} style={storyImg.style}>
              <div className="relative">
                <img
                  src={aboutPortrait}
                  alt="Elias, masajista profesional"
                  className="rounded-2xl aspect-[3/4] object-cover w-full max-w-md ml-auto"
                  loading="lazy"
                  width={800}
                  height={1067}
                />
                <OrganicShape shape="circle" size="w-24 h-24" position="bottom-2 left-2" animation="breathe" color="hsl(var(--organic-dark-foreground) / 0.05)" borderColor="hsl(var(--organic-dark-foreground) / 0.1)" className="border" delay={0} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <CurvedDivider from="bg-organic-dark" to="bg-background" />

      {/* ═══════════ TESTIMONIALS — Auto-sliding single row ═══════════ */}
      <section className="px-6 md:px-12 lg:px-20 py-20 md:py-28">
        <div className="max-w-5xl mx-auto">
          <div ref={testimonialsTitle.ref} style={testimonialsTitle.style} className="text-center mb-4">
            <h2 className="font-display text-3xl md:text-4xl mb-2">{t.testimonials.title}</h2>
            <p className="text-sm text-muted-foreground font-body mb-1">{sc.google_rating || "5.0"} ★ — {sc.google_review_count || "66"}+ Google & TripAdvisor reviews</p>
            <div className="w-12 h-px bg-primary mx-auto mt-3" />
          </div>
        </div>

        {/* Full-width auto-sliding marquee */}
        {(() => {
          const TestimonialsMarquee = () => {
            const trackRef = useRef<HTMLDivElement>(null);
            const offsetRef = useRef(0);
            const rafRef = useRef<number>(0);
            const isDragging = useRef(false);
            const dragStartX = useRef(0);
            const dragOffset = useRef(0);
            const velocity = useRef(0);
            const [, setTick] = useState(0);

            const items = testimonialItems;
            const dupeCount = 4;
            const allItems = Array.from({ length: dupeCount }, () => items).flat();
            const CARD_WIDTH = 320;
            const GAP = 20;
            const itemWidth = CARD_WIDTH + GAP;
            const totalWidth = items.length * itemWidth;
            const SPEED = 0.35;

            const animate = useCallback(() => {
              if (!isDragging.current) {
                // Apply any remaining drag velocity
                if (Math.abs(velocity.current) > 0.1) {
                  offsetRef.current += velocity.current;
                  velocity.current *= 0.95;
                } else {
                  velocity.current = 0;
                  offsetRef.current -= SPEED;
                }
              }
              // Loop
              if (Math.abs(offsetRef.current) >= totalWidth) {
                offsetRef.current += totalWidth;
              }
              if (offsetRef.current > 0) {
                offsetRef.current -= totalWidth;
              }
              setTick((t) => t + 1);
              rafRef.current = requestAnimationFrame(animate);
            }, [totalWidth]);

            useEffect(() => {
              rafRef.current = requestAnimationFrame(animate);
              return () => cancelAnimationFrame(rafRef.current);
            }, [animate]);

            const handlePointerDown = (e: React.PointerEvent) => {
              isDragging.current = true;
              dragStartX.current = e.clientX;
              dragOffset.current = offsetRef.current;
              velocity.current = 0;
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            };

            const handlePointerMove = (e: React.PointerEvent) => {
              if (!isDragging.current) return;
              const dx = e.clientX - dragStartX.current;
              offsetRef.current = dragOffset.current + dx;
              velocity.current = dx * 0.05;
            };

            const handlePointerUp = () => {
              isDragging.current = false;
            };

            return (
              <div
                className="mt-10 overflow-hidden cursor-grab active:cursor-grabbing select-none"
                style={{ width: "100vw", position: "relative", left: "50%", transform: "translateX(-50%)" }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              >
                <div
                  ref={trackRef}
                  className="flex"
                  style={{
                    transform: `translateX(${offsetRef.current}px)`,
                    gap: GAP,
                    willChange: "transform",
                  }}
                >
                  {allItems.map((item, i) => (
                    <div
                      key={i}
                      className="bg-secondary/60 rounded-2xl border border-border/50 p-6 shrink-0"
                      style={{ width: CARD_WIDTH }}
                    >
                      <p className="text-sm text-muted-foreground font-body leading-relaxed italic mb-4">
                        "{item.quote}"
                      </p>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-body font-medium">— {item.name}</p>
                        {item.source && (
                          <span className="text-[10px] font-body text-muted-foreground/60 uppercase tracking-wider">{item.source}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          };
          return <TestimonialsMarquee />;
        })()}
      </section>

      {/* ═══════════ LOCATION ═══════════ */}
      <section className="relative overflow-hidden">
        {/* Top half-moon */}
        <div className="relative z-10">
          <svg viewBox="0 0 1440 180" preserveAspectRatio="none" className="w-full h-[5vh] md:h-[6vh] max-h-16 block" style={{ marginBottom: "-1px" }}>
            <ellipse cx="720" cy="0" rx="900" ry="180" style={{ fill: bgColor("--background") }} />
          </svg>
        </div>

        {/* Background image */}
        <div className="absolute inset-0">
          <img
            src={locationBg}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-background/70" />
        </div>

        <div className="relative z-10 px-6 md:px-12 lg:px-20 py-20 md:py-28">
          <div className="max-w-5xl mx-auto">
            {(() => {
              const Loc = () => {
                const anim = useFadeIn(0);
                return (
                  <div ref={anim.ref} style={anim.style}>
                    <h2 className="font-display text-3xl md:text-4xl text-center mb-12">{sc.location_title || t.location.title}</h2>
                    <div className="rounded-2xl overflow-hidden border border-border">
                      <MapBlock />
                    </div>
                  </div>
                );
              };
              return <Loc />;
            })()}
          </div>
        </div>

        {/* Bottom half-moon */}
        <div className="relative z-10">
          <svg viewBox="0 0 1440 180" preserveAspectRatio="none" className="w-full h-[5vh] md:h-[6vh] max-h-16 block" style={{ marginTop: "-1px" }}>
            <ellipse cx="720" cy="180" rx="900" ry="180" style={{ fill: solidBgColor("--background") }} />
          </svg>
        </div>
      </section>

      {/* ═══════════ FAQ ═══════════ */}
      <section
        className="px-6 md:px-12 lg:px-20 py-20 md:py-28 relative overflow-hidden"
        style={{ backgroundColor: solidBgColor("--background") }}
      >
        {/* Warm glow accent behind FAQ heading — visible mainly in dark-gradient mode */}
        <div
          className="absolute pointer-events-none"
          aria-hidden="true"
          style={{
            top: "8%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(600px, 80vw)",
            height: "280px",
            background: "radial-gradient(ellipse 100% 100% at 50% 40%, hsl(var(--primary) / 0.07) 0%, transparent 70%)",
            animation: "ambient-breathe 22s ease-in-out infinite",
          }}
        />
        <OrganicShape shape="ring" size="w-28 h-28" position="top-4 right-12" animation="float" borderColor="hsl(var(--primary) / 0.08)" delay={1500} />
        <OrganicShape shape="blob" size="w-36 h-36" position="bottom-10 left-4" animation="drift" color="hsl(var(--primary) / 0.03)" delay={4000} />
        <div className="max-w-2xl mx-auto relative z-[1]">
          {(() => {
            const Faq = () => {
              const anim = useFadeIn(0);
              return (
                <div
                  ref={anim.ref}
                  style={{
                    opacity: anim.style.opacity,
                    transition: anim.style.transition,
                    willChange: "opacity",
                  }}
                >
                  <h2 className="font-display text-3xl md:text-4xl text-center mb-12">{t.faq.title}</h2>
                  <FaqAccordion items={faqItems} />
                </div>
              );
            };
            return <Faq />;
          })()}
        </div>
      </section>
      <div
        className="relative h-16 md:h-24 overflow-hidden"
        style={{ backgroundColor: solidBgColor("--background") }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 1440 96" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
          <path d="M0,0 C480,96 960,96 1440,0 L1440,96 L0,96 Z" style={{ fill: bgColor("--organic-dark") }} />
        </svg>
      </div>

      {/* ═══════════ GIFT CARD — Dark section ═══════════ */}
      <section className="px-6 md:px-12 lg:px-20 py-16 md:py-20" style={{ backgroundColor: bgColor("--organic-dark") }}>
        <div className="max-w-3xl mx-auto text-center">
          {(() => {
            const GiftSection = () => {
              const anim = useFadeIn(0);
              return (
                <div ref={anim.ref} style={anim.style}>
                   <h2 className="font-display text-2xl md:text-3xl mb-3" style={{ color: "hsl(var(--organic-dark-foreground))" }}>{sc.gift_card_title || t.giftCard.title}</h2>
                   <p className="text-sm font-body mb-6" style={{ color: "hsl(var(--organic-dark-muted))" }}>{sc.gift_card_description || t.giftCard.description}</p>
                  <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackWhatsAppClick("home_gift_card")}
                    className="inline-block text-sm font-body px-6 py-2.5 rounded-full transition-all hover:opacity-90 hover:-translate-y-0.5"
                    style={{ backgroundColor: "hsl(var(--organic-dark-foreground))", color: "hsl(var(--organic-dark))" }}
                  >
                    {sc.gift_card_cta || t.giftCard.cta}
                  </a>
                </div>
              );
            };
            return <GiftSection />;
          })()}
        </div>
      </section>

      <CurvedDivider from="bg-organic-dark" to="bg-background" flip />

      {/* ═══════════ FINAL CTA — Quiet confidence ═══════════ */}
      <section className="px-6 md:px-12 lg:px-20 py-24 md:py-32 relative overflow-hidden">
        <OrganicShape shape="ring" size="w-40 h-40" position="bottom-4 right-4" animation="breathe" borderColor="hsl(var(--foreground) / 0.06)" delay={2000} />
        <OrganicShape shape="arc" size="w-20 h-10" position="top-16 left-8" animation="float" borderColor="hsl(var(--primary) / 0.1)" delay={500} />
        <div className="max-w-2xl mx-auto text-center" ref={ctaBlock.ref} style={ctaBlock.style}>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl mb-5 leading-snug">{sc.final_cta_title || t.finalCta.title}</h2>
          <p className="text-base text-muted-foreground font-body leading-relaxed mb-10">{sc.final_cta_description || t.finalCta.description}</p>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackWhatsAppClick("home_final_cta")}
            className="inline-block text-sm font-body bg-foreground text-background px-10 py-4 rounded-full transition-all hover:opacity-90 hover:-translate-y-0.5"
          >
            {sc.final_cta_button || t.finalCta.cta}
          </a>
        </div>
      </section>
    </div>
  );
};

export default OrganicHome;
