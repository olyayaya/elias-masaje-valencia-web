import massageNeck from "@/assets/massage-neck.jpg";
import massageWrist from "@/assets/massage-wrist.jpg";
import massageShoulder from "@/assets/massage-shoulder.jpg";
import { useI18n } from "@/i18n/context";
import { useFadeIn } from "@/hooks/use-fade-in";
import CircularImage from "@/components/CircularImage";
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
      {/* Hero — editorial split */}
      <section className="px-6 md:px-12 lg:px-20 py-20 md:py-28">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
            <div className="md:col-span-5" ref={heroText.ref} style={heroText.style}>
              <p className="text-xs font-body tracking-[0.3em] uppercase text-muted-foreground mb-4">
                Treatments
              </p>
              <h1 className="font-display text-4xl md:text-5xl leading-snug mb-6">{t.services.title}</h1>
              <p className="text-base text-muted-foreground font-body leading-[1.8]">{t.services.pageSubtitle}</p>
            </div>
            <div className="md:col-span-6 md:col-start-7" ref={heroImg.ref} style={heroImg.style}>
              <img
                src={serviceImage}
                alt="Detalle de productos de masaje"
                className="rounded-2xl aspect-[4/3] object-cover w-full"
                loading="lazy"
                width={800}
                height={600}
              />
            </div>
          </div>
        </div>
      </section>

      <CurvedDivider from="bg-background" to="bg-secondary" />

      {/* Circular image cluster */}
      <section className="bg-secondary px-6 md:px-12 lg:px-20 py-16 md:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-wrap justify-center gap-6 md:gap-0">
            <CircularImage src={massageWrist} alt="Massage technique" size="md" delay={0} className="md:-mr-6" />
            <CircularImage src={serviceImage} alt="Service detail" size="lg" delay={0.1} className="md:z-10 md:-mt-4" />
            <CircularImage src={massageShoulder} alt="Shoulder work" size="md" delay={0.2} className="md:-ml-6 md:mt-8" />
            <CircularImage src={aboutPortrait} alt="Elias" size="sm" delay={0.3} className="md:-ml-4 md:mt-2" />
          </div>
        </div>
      </section>

      <CurvedDivider from="bg-secondary" to="bg-background" flip />

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

      {/* Quiet CTA */}
      <section className="bg-secondary px-6 md:px-12 lg:px-20 py-16 md:py-20">
        <div className="max-w-2xl mx-auto text-center">
          {(() => {
            const Cta = () => {
              const anim = useFadeIn(0);
              return (
                <div ref={anim.ref} style={anim.style}>
                  <h2 className="font-display text-3xl md:text-4xl mb-4">{t.finalCta.title}</h2>
                  <p className="text-sm text-muted-foreground font-body mb-8">{t.finalCta.description}</p>
                  <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-sm font-body bg-foreground text-background px-10 py-3.5 rounded-full transition-all hover:opacity-90 hover:-translate-y-0.5"
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
