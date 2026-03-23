import { Link } from "react-router-dom";
import heroImageDefault from "@/assets/hero-massage.jpg";
import heroImageNatural from "@/assets/hero-natural.jpg";
import { useTheme } from "@/contexts/ThemeContext";
import aboutPortrait from "@/assets/about-portrait.jpg";
import ServiceCard from "@/components/ServiceCard";
import FaqAccordion from "@/components/FaqAccordion";
import TestimonialCard from "@/components/TestimonialCard";
import GiftCardHighlight from "@/components/GiftCardHighlight";
import MapBlock from "@/components/MapBlock";
import { useI18n } from "@/i18n/context";
import BenefitIcon from "@/components/BenefitIcon";

const WHATSAPP_URL = "https://wa.me/34698968007?text=Hola%2C%20me%20gustaría%20reservar%20una%20cita";

const Index = () => {
  const { t } = useI18n();
  const { theme } = useTheme();
  const heroImage = theme === "natural" ? heroImageNatural : heroImageDefault;
  const previewServices = t.services.items.slice(0, 3);

  return (
    <div>
      {/* Hero */}
      <section className="relative min-h-[85vh] flex items-center">
        <div className="absolute inset-0">
          <img src={heroImage} alt="Sala de masaje profesional en Valencia" className="w-full h-full object-cover" width={1920} height={1080} />
          <div className="absolute inset-0 bg-foreground/40" />
        </div>
        <div className="relative z-10 section-padding w-full">
          <div className="container-narrow">
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl text-primary-foreground leading-tight mb-6">
              {t.hero.headline}
            </h1>
            <p className="text-base md:text-lg text-primary-foreground/80 font-body leading-relaxed mb-8 max-w-lg">
              {t.hero.subheadline}
            </p>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm font-body bg-primary text-primary-foreground px-7 py-3 rounded transition-opacity hover:opacity-90"
            >
              {t.hero.cta}
            </a>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="section-padding">
        <div className="container-wide">
          <h2 className="font-display text-3xl md:text-4xl text-center mb-12">{t.benefits.title}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {t.benefits.items.map((b, i) => (
              <div key={i} className="text-center">
                <BenefitIcon index={i} />
                <h3 className="font-display text-xl mb-2">{b.title}</h3>
                <p className="text-sm text-muted-foreground font-body leading-relaxed">{b.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services preview */}
      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <div className="flex items-end justify-between mb-12">
            <h2 className="font-display text-3xl md:text-4xl">{t.services.title}</h2>
            <Link to="/servicios" className="text-sm font-body text-primary hover:opacity-80 transition-opacity">
              {t.services.viewAll}
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {previewServices.map((s, i) => (
              <ServiceCard key={i} {...s} />
            ))}
          </div>
        </div>
      </section>

      {/* About preview */}
      <section className="section-padding">
        <div className="container-wide">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <img
              src={aboutPortrait}
              alt="Elias, masajista profesional"
              className="rounded aspect-[4/5] object-cover w-full max-w-sm mx-auto md:mx-0"
              loading="lazy"
              width={800}
              height={1000}
            />
            <div>
              <h2 className="font-display text-3xl md:text-4xl mb-6">{t.about.title}</h2>
              <p className="text-sm text-muted-foreground font-body leading-relaxed mb-4">{t.about.previewP1}</p>
              <p className="text-sm text-muted-foreground font-body leading-relaxed mb-6">{t.about.previewP2}</p>
              <Link to="/sobre-mi" className="text-sm font-body text-primary hover:opacity-80 transition-opacity">
                {t.about.learnMore}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <h2 className="font-display text-3xl md:text-4xl text-center mb-12">{t.testimonials.title}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {t.testimonials.items.map((item, i) => (
              <TestimonialCard key={i} {...item} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* Location */}
      <section className="section-padding">
        <div className="container-wide">
          <h2 className="font-display text-3xl md:text-4xl text-center mb-12">{t.location.title}</h2>
          <MapBlock />
        </div>
      </section>

      {/* FAQ */}
      <section className="section-padding bg-secondary">
        <div className="container-narrow">
          <h2 className="font-display text-3xl md:text-4xl text-center mb-12">{t.faq.title}</h2>
          <FaqAccordion items={t.faq.items} />
        </div>
      </section>

      <GiftCardHighlight />

      {/* Final CTA */}
      <section className="section-padding">
        <div className="container-narrow text-center">
          <h2 className="font-display text-3xl md:text-4xl mb-4">{t.finalCta.title}</h2>
          <p className="text-sm text-muted-foreground font-body leading-relaxed mb-8">{t.finalCta.description}</p>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm font-body bg-primary text-primary-foreground px-7 py-3 rounded transition-opacity hover:opacity-90"
          >
            {t.finalCta.cta}
          </a>
        </div>
      </section>
    </div>
  );
};

export default Index;
