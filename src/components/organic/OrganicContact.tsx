import { MapPin, Clock, MessageCircle, Instagram } from "lucide-react";
import MapBlock from "@/components/MapBlock";
import { useI18n } from "@/i18n/context";
import { useFadeIn } from "@/hooks/use-fade-in";
import CurvedDivider from "@/components/CurvedDivider";
import OrganicShape from "@/components/organic/OrganicShape";

const WHATSAPP_URL = "https://wa.me/34698968007?text=Hola%2C%20me%20gustaría%20reservar%20una%20cita";

const ContactItem = ({ icon: Icon, title, children, index }: {
  icon: typeof MapPin; title: string; children: React.ReactNode; index: number;
}) => {
  const anim = useFadeIn(index * 0.1);
  return (
    <div ref={anim.ref} style={anim.style} className="flex gap-5">
      <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "hsl(var(--accent) / 0.15)" }}>
        <Icon size={18} className="text-primary" />
      </div>
      <div>
        <h3 className="font-display text-lg mb-1.5">{title}</h3>
        {children}
      </div>
    </div>
  );
};

const OrganicContact = () => {
  const { t } = useI18n();
  const heading = useFadeIn(0);
  const mapAnim = useFadeIn(0.15);

  return (
    <div>
      {/* Hero heading */}
      <section className="px-6 md:px-12 lg:px-20 pt-20 pb-12 md:pt-28 md:pb-16 relative overflow-hidden">
        <OrganicShape shape="ring" size="w-32 h-32" position="top-8 -right-10" animation="drift" borderColor="hsl(var(--primary) / 0.08)" delay={500} />
        <div className="max-w-6xl mx-auto" ref={heading.ref} style={heading.style}>
          <p className="text-xs font-body tracking-[0.3em] uppercase text-foreground/70 mb-4">
            Get in touch
          </p>
          <h1 className="font-display text-4xl md:text-5xl lg:text-[3.5rem] leading-snug max-w-md">
            {t.contact.title}
          </h1>
        </div>
      </section>

      {/* Contact details + map */}
      <section className="px-6 md:px-12 lg:px-20 pb-20 md:pb-28">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
            {/* Details */}
            <div className="md:col-span-5 space-y-8">
              <ContactItem icon={MapPin} title={t.contact.address} index={0}>
                <p className="text-sm text-muted-foreground font-body">{t.contact.addressValue}</p>
              </ContactItem>

              <ContactItem icon={Clock} title={t.contact.hours} index={1}>
                <div className="text-sm text-muted-foreground font-body space-y-1">
                  <p>{t.contact.weekdays}</p>
                  <p>{t.contact.saturday}</p>
                  <p>{t.contact.sunday}</p>
                </div>
              </ContactItem>

              <ContactItem icon={MessageCircle} title={t.contact.whatsapp} index={2}>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 text-sm font-body bg-foreground text-background px-6 py-2.5 rounded-full transition-all hover:opacity-90 hover:-translate-y-0.5"
                >
                  {t.contact.sendMessage}
                </a>
              </ContactItem>

              <ContactItem icon={Instagram} title={t.contact.instagram} index={3}>
                <a
                  href="https://instagram.com/elias_masaje"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary font-body hover:opacity-80 transition-opacity border-b border-primary/30 pb-0.5"
                >
                  @elias_masaje
                </a>
              </ContactItem>
            </div>

            {/* Map */}
            <div className="md:col-span-6 md:col-start-7" ref={mapAnim.ref} style={mapAnim.style}>
              <div className="rounded-2xl overflow-hidden border border-border">
                <MapBlock />
              </div>
            </div>
          </div>
        </div>
      </section>

      <CurvedDivider from="bg-background" to="bg-secondary" />

      {/* Quiet CTA */}
      <section className="bg-secondary px-6 md:px-12 lg:px-20 py-16 md:py-20 relative overflow-hidden">
        <OrganicShape shape="blob" size="w-40 h-40" position="-bottom-16 -right-16" animation="breathe" color="hsl(var(--primary) / 0.04)" delay={2000} />
        <OrganicShape shape="arc" size="w-20 h-10" position="top-10 left-12" animation="float" borderColor="hsl(var(--primary) / 0.1)" delay={0} />
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

export default OrganicContact;
