import aboutPortrait from "@/assets/about-portrait.jpg";
import interiorImage from "@/assets/interior.jpg";
import massageArm from "@/assets/massage-arm.jpg";
import massageBack from "@/assets/massage-back.jpg";
import massageStones from "@/assets/massage-stones.jpg";
import massageOil from "@/assets/massage-oil.jpg";
import massageNeck from "@/assets/massage-neck.jpg";
import massageWrist from "@/assets/massage-wrist.jpg";
import massageFoot from "@/assets/massage-foot.jpg";
import massageDeep from "@/assets/massage-deep.jpg";
import { useI18n } from "@/i18n/context";
import { useFadeIn } from "@/hooks/use-fade-in";
import CircularImageCarousel from "@/components/CircularImageCarousel";
import CurvedDivider from "@/components/CurvedDivider";
import OrganicShape from "@/components/organic/OrganicShape";
import { WHATSAPP_URL } from "@/config/contact";

const OrganicAbout = () => {
  const { t } = useI18n();
  const { mode } = useTheme();
  const isDG = mode === "dark-gradient";
  const bgColor = (cssVar: string) => isDG ? "transparent" : `hsl(var(${cssVar}))`;
  const heroLabel = useFadeIn(0);
  const portrait = useFadeIn(0.1);
  const bio = useFadeIn(0.2);
  const spaceText = useFadeIn(0);
  const spaceImg = useFadeIn(0.15);

  return (
    <div>
      {/* Hero — editorial intro with large portrait */}
      <section className="px-6 md:px-12 lg:px-20 pt-36 pb-20 md:pt-44 md:pb-28 relative overflow-hidden">
        <OrganicShape shape="blob" size="w-48 h-48" position="top-4 right-4" animation="drift" color="hsl(var(--primary) / 0.03)" delay={0} />
        <div className="max-w-6xl mx-auto">
          <div ref={heroLabel.ref} style={heroLabel.style} className="mb-12">
            <p className="text-xs font-body tracking-[0.3em] uppercase text-foreground/70 mb-4">
              {t.about.sectionLabel}
            </p>
            <h1 className="font-display text-4xl md:text-5xl lg:text-[3.5rem] leading-snug max-w-lg">
              {t.about.title}
            </h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-start">
            {/* Portrait — slightly offset */}
            <div className="md:col-span-5" ref={portrait.ref} style={portrait.style}>
              <div className="relative">
                <img
                  src={aboutPortrait}
                  alt="Elias, masajista profesional en Valencia"
                  className="rounded-2xl aspect-[3/4] object-cover w-full"
                  loading="lazy"
                  width={800}
                  height={1067}
                />
                <OrganicShape shape="circle" size="w-20 h-20" position="bottom-2 right-2" animation="breathe" color="hsl(var(--secondary))" className="border border-border" delay={0} />
              </div>
            </div>

            {/* Bio — editorial long-form */}
            <div className="md:col-span-6 md:col-start-7 md:pt-8" ref={bio.ref} style={bio.style}>
              <div className="space-y-5 text-base text-muted-foreground font-body leading-[1.85]">
                {t.about.paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <CurvedDivider from="bg-background" to="bg-secondary" />

      {/* The space — reversed asymmetric layout */}
      <section className="bg-secondary px-6 md:px-12 lg:px-20 py-20 md:py-28 relative overflow-hidden">
        <OrganicShape shape="ring" size="w-36 h-36" position="top-16 -left-12" animation="float" borderColor="hsl(var(--primary) / 0.08)" delay={1000} />
        <OrganicShape shape="arc" size="w-28 h-14" position="bottom-20 right-8" animation="drift" borderColor="hsl(var(--primary) / 0.1)" delay={3000} />
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
            <div className="md:col-span-6 md:order-2" ref={spaceImg.ref} style={spaceImg.style}>
              <img
                src={interiorImage}
                alt="Interior de la consulta de masaje"
                className="rounded-2xl aspect-square object-cover w-full"
                loading="lazy"
                width={1200}
                height={800}
              />
            </div>
            <div className="md:col-span-5 md:col-start-1 md:order-1" ref={spaceText.ref} style={spaceText.style}>
              <p className="text-xs font-body tracking-[0.3em] uppercase text-muted-foreground mb-4">
                {t.about.spaceLabel}
              </p>
              <h2 className="font-display text-3xl md:text-4xl mb-6 leading-snug">{t.about.spaceTitle}</h2>
              <div className="space-y-4 text-base text-muted-foreground font-body leading-[1.8]">
                {t.about.spaceParagraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <CurvedDivider from="bg-secondary" to="bg-background" flip />

      {/* Gallery — auto-sliding horizontal carousel */}
      <section className="pt-20 md:pt-28 pb-0">
        <div className="max-w-5xl mx-auto px-6 md:px-12 lg:px-20">
          {(() => {
            const GalleryTitle = () => {
              const anim = useFadeIn(0);
              return (
                <div ref={anim.ref} style={anim.style} className="text-center mb-16">
                  <h2 className="font-display text-3xl md:text-4xl mb-3">{t.about.gallery}</h2>
                  <div className="w-12 h-px bg-primary mx-auto" />
                </div>
              );
            };
            return <GalleryTitle />;
          })()}
        </div>

        <div className="relative">
          <CircularImageCarousel
            images={[
              { src: massageArm, alt: "Arm massage" },
              { src: massageStones, alt: "Hot stone therapy" },
              { src: massageBack, alt: "Back massage" },
              { src: massageOil, alt: "Oil massage" },
              { src: massageNeck, alt: "Neck massage" },
              { src: massageWrist, alt: "Wrist massage" },
              { src: massageFoot, alt: "Foot massage" },
              { src: massageDeep, alt: "Deep tissue work" },
            ]}
          />

          {/* Bottom half-moon overlaying gallery image on mobile */}
          <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none md:hidden">
            <svg viewBox="0 0 1440 96" preserveAspectRatio="none" className="w-full h-16 block">
              <path d="M0,96 L1440,96 L1440,0 C960,96 480,96 0,0 Z" style={{ fill: "hsl(var(--organic-dark))" }} />
            </svg>
          </div>
        </div>
      </section>

      {/* Desktop curved divider */}
      <div className="hidden md:block">
        <CurvedDivider from="bg-background" to="bg-organic-dark" />
      </div>
      <section className="px-6 md:px-12 lg:px-20 py-20 md:py-28 relative overflow-hidden" style={{ backgroundColor: "hsl(var(--organic-dark))" }}>
        <OrganicShape shape="ring" size="w-32 h-32" position="top-8 right-8" animation="breathe" borderColor="hsl(var(--organic-dark-muted) / 0.15)" delay={0} />
        <OrganicShape shape="arc" size="w-20 h-10" position="bottom-12 left-8" animation="float" borderColor="hsl(var(--organic-dark-muted) / 0.1)" delay={500} />
        {(() => {
          const anim = useFadeIn(0);
          return (
            <div className="max-w-2xl mx-auto text-center" ref={anim.ref} style={anim.style}>
              <h2 className="font-display text-3xl md:text-4xl lg:text-5xl mb-5 leading-snug text-organic-dark-foreground">
                {t.finalCta.title}
              </h2>
              <p className="text-base font-body leading-relaxed mb-10 text-organic-dark-muted">
                {t.finalCta.description}
              </p>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-8 py-3.5 rounded-full bg-primary text-primary-foreground font-body text-sm tracking-wide hover:opacity-90 transition-opacity"
              >
                {t.finalCta.cta}
              </a>
            </div>
          );
        })()}
      </section>
      {/* Bottom divider — match footer bg (foreground color) */}
      <div className="relative h-16 md:h-24 overflow-hidden" style={{ backgroundColor: "hsl(var(--foreground))" }} aria-hidden="true">
        <svg viewBox="0 0 1440 96" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
          <path d="M0,96 C480,0 960,0 1440,96 L1440,0 L0,0 Z" style={{ fill: "hsl(var(--organic-dark))" }} />
        </svg>
      </div>
    </div>
  );
};

export default OrganicAbout;
