import { useState } from "react";
import { MapPin, Clock, MessageCircle, Instagram } from "lucide-react";
import MapBlock, { MapPickerOverlay } from "@/components/MapBlock";
import { useI18n } from "@/i18n/context";
import { useFadeIn } from "@/hooks/use-fade-in";
import { useSiteContent } from "@/hooks/use-site-content";
import CurvedDivider from "@/components/CurvedDivider";
import OrganicShape from "@/components/organic/OrganicShape";
import { useTheme } from "@/contexts/ThemeContext";
import { WHATSAPP_PHONE, WHATSAPP_DEFAULT_MESSAGE, INSTAGRAM_HANDLE, INSTAGRAM_URL } from "@/config/contact";
import { trackWhatsAppClick, trackContactSubmit } from "@/lib/analytics";

const TripAdvisorIcon = ({ size = 18, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M12 7.5c-2.21 0-4.27.61-6.04 1.66H2l1.78 1.94A4.5 4.5 0 0 0 7 18.5c1.27 0 2.42-.53 3.24-1.38L12 19l1.76-1.88c.82.85 1.97 1.38 3.24 1.38a4.5 4.5 0 0 0 3.22-7.4L22 9.16h-3.96A11.97 11.97 0 0 0 12 7.5zM7 10.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zm10 0a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM7 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
  </svg>
);

const ContactItem = ({ icon: Icon, title, children, index }: {
  icon: typeof MapPin; title: string; children: React.ReactNode; index: number;
}) => {
  const anim = useFadeIn(index * 0.1);
  return (
    <div ref={anim.ref} style={anim.style} className="flex gap-5">
      <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "hsl(var(--accent) / 0.15)" }}>
        <Icon size={18} className="text-primary-strong" />
      </div>
      <div>
        <h2 className="font-display text-lg mb-1.5">{title}</h2>
        {children}
      </div>
    </div>
  );
};

const OrganicContact = () => {
  const { t, locale } = useI18n();
  const { content: sc } = useSiteContent();
  const { mode } = useTheme();
  const isDG = mode === "dark-gradient";
  const [showMapPicker, setShowMapPicker] = useState(false);
  const heading = useFadeIn(0);
  const mapAnim = useFadeIn(0.15);

  const whatsappNum = sc.contact_whatsapp || WHATSAPP_PHONE;
  const whatsappUrl = `https://wa.me/${whatsappNum}?text=${WHATSAPP_DEFAULT_MESSAGE}`;

  return (
    <div>
      {/* Hero heading */}
      <section className="px-6 md:px-12 lg:px-20 pt-36 pb-12 md:pt-44 md:pb-16 relative overflow-hidden">
        <OrganicShape shape="ring" size="w-32 h-32" position="top-8 right-4" animation="drift" borderColor="hsl(var(--primary) / 0.08)" delay={500} />
        <div className="max-w-6xl mx-auto" ref={heading.ref} style={heading.style}>
          <p className="text-xs font-body tracking-[0.3em] uppercase text-foreground/70 mb-4">
            {t.contact.sectionLabel}
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
                <button
                  onClick={() => setShowMapPicker(true)}
                  className="text-sm text-muted-foreground font-body text-left hover:text-primary-strong transition-colors border-b border-transparent hover:border-primary/30 cursor-pointer"
                >
                  {sc.contact_address || t.contact.addressValue}
                </button>
              </ContactItem>

              <ContactItem icon={Clock} title={t.contact.hours} index={1}>
                <div className="text-sm text-muted-foreground font-body space-y-1">
                  <p>{sc.contact_weekdays || t.contact.weekdays}</p>
                  <p>{sc.contact_saturday || t.contact.saturday}</p>
                  <p>{sc.contact_sunday || t.contact.sunday}</p>
                </div>
              </ContactItem>

              <ContactItem icon={MessageCircle} title={t.contact.whatsapp} index={2}>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    trackWhatsAppClick("contact_page_send_message");
                    trackContactSubmit("contact_page_whatsapp");
                  }}
                  className="inline-block mt-2 text-sm font-body bg-foreground text-background px-6 py-2.5 rounded-full transition-all hover:opacity-90 hover:-translate-y-0.5"
                >
                  {t.contact.sendMessage}
                </a>
              </ContactItem>

              <ContactItem icon={Instagram} title={t.contact.instagram} index={3}>
                <a
                  href={`https://instagram.com/${(sc.contact_instagram || INSTAGRAM_HANDLE).replace("@", "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary-strong font-body hover:opacity-80 transition-opacity border-b border-primary/30 pb-0.5"
                >
                  {sc.contact_instagram || INSTAGRAM_HANDLE}
                </a>
              </ContactItem>

              {(sc.integration_tripadvisor_url || sc.contact_tripadvisor_url) && (
                <ContactItem icon={TripAdvisorIcon as any} title="TripAdvisor" index={4}>
                  <a
                    href={sc.integration_tripadvisor_url || sc.contact_tripadvisor_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary-strong font-body hover:opacity-80 transition-opacity border-b border-primary/30 pb-0.5"
                  >
                    {locale === "ru" ? "Читать отзывы" : locale === "es" ? "Ver reseñas" : "Read reviews"}
                  </a>
                </ContactItem>
              )}
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
      <section className={`${isDG ? '' : 'bg-secondary'} px-6 md:px-12 lg:px-20 py-16 md:py-20 relative overflow-hidden`}>
        <OrganicShape shape="blob" size="w-40 h-40" position="bottom-4 right-4" animation="breathe" color="hsl(var(--primary) / 0.04)" delay={2000} />
        <OrganicShape shape="arc" size="w-20 h-10" position="top-10 left-12" animation="float" borderColor="hsl(var(--primary) / 0.1)" delay={0} />
        <div className="max-w-2xl mx-auto text-center">
          {(() => {
            const Cta = () => {
              const anim = useFadeIn(0);
              return (
                <div ref={anim.ref} style={anim.style}>
                  <h2 className="font-display text-3xl md:text-4xl mb-4">{sc.final_cta_title || t.finalCta.title}</h2>
                  <p className="text-sm text-muted-foreground font-body mb-8">{sc.final_cta_description || t.finalCta.description}</p>
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      trackWhatsAppClick("contact_page_final_cta");
                      trackContactSubmit("contact_page_final_cta");
                    }}
                    className="inline-block text-sm font-body bg-foreground text-background px-10 py-3.5 rounded-full transition-all hover:opacity-90 hover:-translate-y-0.5"
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

      {showMapPicker && <MapPickerOverlay onClose={() => setShowMapPicker(false)} />}
    </div>
  );
};

export default OrganicContact;
