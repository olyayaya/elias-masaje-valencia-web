import { useRef } from "react";
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
import { useI18n } from "@/i18n/context";
import { useFadeIn } from "@/hooks/use-fade-in";
import CircularImage from "@/components/CircularImage";
import CircularImageCarousel from "@/components/CircularImageCarousel";
import CurvedDivider from "@/components/CurvedDivider";
import FaqAccordion from "@/components/FaqAccordion";
import MapBlock from "@/components/MapBlock";

const WHATSAPP_URL = "https://wa.me/34698968007?text=Hola%2C%20me%20gustaría%20reservar%20una%20cita";

const OrganicHome = () => {
  const { t } = useI18n();

  const heroText = useFadeIn(0.2);
  const benefitsTitle = useFadeIn(0);
  const servicesTitle = useFadeIn(0);
  const storyText = useFadeIn(0);
  const storyImg = useFadeIn(0.15);
  const testimonialsTitle = useFadeIn(0);
  const ctaBlock = useFadeIn(0);

  const previewServices = t.services.items.slice(0, 3);

  return (
    <div>
      {/* ═══════════ EDITORIAL HERO — Split layout ═══════════ */}
      <section className="relative min-h-[85vh] md:min-h-[92vh] flex items-center overflow-hidden">
        {/* Background image with soft overlay */}
        <div className="absolute inset-0">
          <img
            src={heroImageOrganic}
            alt="Masaje profesional"
            className="w-full h-full object-cover object-bottom"
            width={1920}
            height={1080}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/50 to-transparent" />
        </div>

        <div className="relative z-10 w-full px-6 md:px-12 lg:px-20 pt-20 pb-[18vh] md:pb-[20vh]">
          <div className="max-w-xl" ref={heroText.ref} style={heroText.style}>
            <p className="text-xs font-body tracking-[0.3em] uppercase text-muted-foreground mb-6">
              Valencia · Massage · Wellness
            </p>
            <h1 className="font-display text-4xl md:text-5xl lg:text-[3.5rem] leading-[1.15] mb-6">
              {t.hero.headline}
            </h1>
            <p className="text-base md:text-lg text-muted-foreground font-body leading-relaxed mb-10 max-w-md">
              {t.hero.subheadline}
            </p>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm font-body bg-foreground text-background px-8 py-3.5 rounded-full transition-all hover:opacity-90 hover:-translate-y-0.5"
            >
              {t.hero.cta}
            </a>
          </div>
        </div>

        {/* Half-moon overlap into benefits section */}
        <div className="absolute bottom-0 left-0 right-0 z-20">
          <svg viewBox="0 0 1440 180" preserveAspectRatio="none" className="w-full h-[6vh] md:h-[8vh] max-h-20 block">
            <ellipse cx="720" cy="180" rx="900" ry="180" style={{ fill: "hsl(var(--organic-dark))" }} />
          </svg>
        </div>
      </section>

      {/* ═══════════ BENEFITS — Dark section ═══════════ */}
      <section className="-mt-2 relative z-20 px-6 md:px-12 lg:px-20 pt-8 md:pt-12 pb-20 md:pb-28" style={{ backgroundColor: "hsl(var(--organic-dark))" }}>
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
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-1" style={{ backgroundColor: "hsl(var(--organic-dark-foreground) / 0.1)" }}>
                      <span className="text-sm font-body font-medium" style={{ color: "hsl(var(--primary))" }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
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
      <section className="bg-secondary px-6 md:px-12 lg:px-20 py-20 md:py-28 overflow-hidden">
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
                      <span className="text-sm font-body text-muted-foreground">{s.duration}</span>
                      <span className="text-sm font-body font-medium">{s.price}</span>
                      <a
                        href={WHATSAPP_URL}
                        target="_blank"
                        rel="noopener noreferrer"
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

          {/* Circular image cluster — carousel on mobile, static on desktop */}
          <CircularImageCarousel
            images={[
              { src: massageWrist, alt: "Wrist massage" },
              { src: massageBack, alt: "Back massage" },
              { src: massageNeck, alt: "Neck massage" },
              { src: massageStones, alt: "Hot stone therapy" },
              { src: massageShoulder, alt: "Shoulder massage" },
              { src: massageDeep, alt: "Deep tissue work" },
              { src: massageOil, alt: "Oil massage" },
              { src: massageArm, alt: "Arm massage" },
              { src: massageFoot, alt: "Foot massage" },
            ]}
          />
        </div>
      </section>

      <CurvedDivider from="bg-secondary" to="bg-organic-dark" flip />

      {/* ═══════════ STORY — Dark editorial section ═══════════ */}
      <section className="px-6 md:px-12 lg:px-20 py-20 md:py-28" style={{ backgroundColor: "hsl(var(--organic-dark))" }}>
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
                {t.about.previewP1}
              </p>
              <p className="text-base font-body leading-[1.8] mb-8" style={{ color: "hsl(var(--organic-dark-muted))" }}>
                {t.about.previewP2}
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
                <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full border -z-10" style={{ backgroundColor: "hsl(var(--organic-dark-foreground) / 0.05)", borderColor: "hsl(var(--organic-dark-foreground) / 0.1)" }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <CurvedDivider from="bg-organic-dark" to="bg-background" />

      {/* ═══════════ TESTIMONIALS — Swipable on mobile, grid on desktop ═══════════ */}
      <section className="px-6 md:px-12 lg:px-20 py-20 md:py-28">
        <div className="max-w-5xl mx-auto">
          <div ref={testimonialsTitle.ref} style={testimonialsTitle.style} className="text-center mb-4">
            <h2 className="font-display text-3xl md:text-4xl mb-2">{t.testimonials.title}</h2>
            <p className="text-sm text-muted-foreground font-body mb-1">5.0 ★ — 66+ Google & TripAdvisor reviews</p>
            <div className="w-12 h-px bg-primary mx-auto mt-3" />
          </div>

          {/* Desktop: grid */}
          <div className="hidden md:grid md:grid-cols-3 gap-6 mt-12">
            {t.testimonials.items.slice(0, 6).map((item, i) => {
              const TestimonialOrganic = () => {
                const anim = useFadeIn(i * 0.12);
                return (
                  <div
                    ref={anim.ref}
                    style={anim.style}
                    className={`bg-card rounded-2xl border border-border p-8 ${
                      i === 1 ? "md:-translate-y-4" : i === 4 ? "md:-translate-y-4" : ""
                    }`}
                  >
                    <p className="text-base text-muted-foreground font-body leading-relaxed italic mb-6">
                      "{item.quote}"
                    </p>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-body font-medium">— {item.name}</p>
                      {item.source && (
                        <span className="text-[10px] font-body text-muted-foreground/60 uppercase tracking-wider">{item.source}</span>
                      )}
                    </div>
                  </div>
                );
              };
              return <TestimonialOrganic key={i} />;
            })}
          </div>

          {/* Mobile: swipable carousel */}
          <div className="md:hidden mt-10">
            {(() => {
              const MobileTestimonials = () => {
                const scrollRef = useRef<HTMLDivElement>(null);
                return (
                  <div
                    ref={scrollRef}
                    className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 -mx-6 px-6"
                    style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
                  >
                    {t.testimonials.items.map((item, i) => (
                      <div
                        key={i}
                        className="bg-card rounded-2xl border border-border p-6 snap-center shrink-0"
                        style={{ width: "85vw", maxWidth: "340px" }}
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
                );
              };
              return <MobileTestimonials />;
            })()}
          </div>
        </div>
      </section>

      <CurvedDivider from="bg-background" to="bg-secondary" />

      {/* ═══════════ LOCATION ═══════════ */}
      <section className="bg-secondary px-6 md:px-12 lg:px-20 py-20 md:py-28">
        <div className="max-w-5xl mx-auto">
          {(() => {
            const Loc = () => {
              const anim = useFadeIn(0);
              return (
                <div ref={anim.ref} style={anim.style}>
                  <h2 className="font-display text-3xl md:text-4xl text-center mb-12">{t.location.title}</h2>
                  <div className="rounded-2xl overflow-hidden border border-border">
                    <MapBlock />
                  </div>
                </div>
              );
            };
            return <Loc />;
          })()}
        </div>
      </section>

      <CurvedDivider from="bg-secondary" to="bg-background" flip />

      {/* ═══════════ FAQ ═══════════ */}
      <section className="px-6 md:px-12 lg:px-20 py-20 md:py-28">
        <div className="max-w-2xl mx-auto">
          {(() => {
            const Faq = () => {
              const anim = useFadeIn(0);
              return (
                <div ref={anim.ref} style={anim.style}>
                  <h2 className="font-display text-3xl md:text-4xl text-center mb-12">{t.faq.title}</h2>
                  <FaqAccordion items={t.faq.items} />
                </div>
              );
            };
            return <Faq />;
          })()}
        </div>
      </section>

      {/* ═══════════ GIFT CARD — Minimal ═══════════ */}
      <section className="bg-secondary px-6 md:px-12 lg:px-20 py-16 md:py-20">
        <div className="max-w-3xl mx-auto text-center">
          {(() => {
            const GiftSection = () => {
              const anim = useFadeIn(0);
              return (
                <div ref={anim.ref} style={anim.style}>
                  <h2 className="font-display text-2xl md:text-3xl mb-3">{t.giftCard.title}</h2>
                  <p className="text-sm text-muted-foreground font-body mb-6">{t.giftCard.description}</p>
                  <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-sm font-body border border-foreground/20 text-foreground px-6 py-2.5 rounded-full transition-all hover:bg-foreground hover:text-background"
                  >
                    {t.giftCard.cta}
                  </a>
                </div>
              );
            };
            return <GiftSection />;
          })()}
        </div>
      </section>

      {/* ═══════════ FINAL CTA — Quiet confidence ═══════════ */}
      <section className="px-6 md:px-12 lg:px-20 py-24 md:py-32">
        <div className="max-w-2xl mx-auto text-center" ref={ctaBlock.ref} style={ctaBlock.style}>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl mb-5 leading-snug">{t.finalCta.title}</h2>
          <p className="text-base text-muted-foreground font-body leading-relaxed mb-10">{t.finalCta.description}</p>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm font-body bg-foreground text-background px-10 py-4 rounded-full transition-all hover:opacity-90 hover:-translate-y-0.5"
          >
            {t.finalCta.cta}
          </a>
        </div>
      </section>
    </div>
  );
};

export default OrganicHome;
