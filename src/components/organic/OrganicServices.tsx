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
import CircularImageCarousel from "@/components/CircularImageCarousel";
import CurvedDivider from "@/components/CurvedDivider";

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
  const { t } = useI18n();
  const heroText = useFadeIn(0.1);
  const heroImg = useFadeIn(0.25);

  return (
    <div>
      {/* Hero — full bleed image */}
      <section className="relative min-h-[60vh] md:min-h-[70vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={massageNeck}
            alt="Masaje profesional"
            className="w-full h-full object-cover object-[center_30%]"
            width={1920}
            height={1080}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/50 to-transparent" />
        </div>
        <div className="relative z-10 w-full px-6 md:px-12 lg:px-20 py-20 pb-[16vh]">
          <div className="max-w-xl" ref={heroText.ref} style={heroText.style}>
            <p className="text-xs font-body tracking-[0.3em] uppercase text-muted-foreground mb-4">
              Treatments
            </p>
            <h1 className="font-display text-4xl md:text-5xl leading-snug mb-6">{t.services.title}</h1>
            <p className="text-base text-muted-foreground font-body leading-[1.8] max-w-md">{t.services.pageSubtitle}</p>
          </div>
        </div>

        {/* Half-moon overlap into services section */}
        <div className="absolute bottom-0 left-0 right-0 z-20">
          <svg viewBox="0 0 1440 180" preserveAspectRatio="none" className="w-full h-[10vh] md:h-[12vh] max-h-28 block">
            <ellipse cx="720" cy="180" rx="900" ry="180" style={{ fill: "hsl(var(--background))" }} />
          </svg>
        </div>
      </section>

      {/* Services list — editorial */}
      <section className="px-6 md:px-12 lg:px-20 py-20 md:py-28">
        <div className="max-w-5xl mx-auto">
          <div className="space-y-0 divide-y divide-border">
            {t.services.items.map((s, i) => (
              <ServiceRow key={i} {...s} bookLabel={t.services.bookBtn} index={i} />
            ))}
          </div>
        </div>
      </section>

      <CurvedDivider from="bg-background" to="bg-secondary" />

      {/* Circular image cluster */}
      <section className="bg-secondary px-6 md:px-12 lg:px-20 py-16 md:py-20">
        <div className="max-w-5xl mx-auto">
          <CircularImageCarousel
            images={[
              { src: massageWrist, alt: "Massage technique" },
              { src: massageNeck, alt: "Neck massage" },
              { src: massageShoulder, alt: "Shoulder work" },
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
                  <h2 className="font-display text-3xl md:text-4xl mb-4" style={{ color: "hsl(var(--organic-dark-foreground))" }}>{t.finalCta.title}</h2>
                  <p className="text-sm font-body mb-8" style={{ color: "hsl(var(--organic-dark-muted))" }}>{t.finalCta.description}</p>
                  <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-sm font-body px-10 py-3.5 rounded-full transition-all hover:opacity-90 hover:-translate-y-0.5"
                    style={{ backgroundColor: "hsl(var(--organic-dark-foreground))", color: "hsl(var(--organic-dark))" }}
                  >
                    {t.finalCta.cta}
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
