import { Gift } from "lucide-react";
import { useI18n } from "@/i18n/context";
import { whatsappUrl } from "@/config/contact";

const GIFT_WHATSAPP_URL = whatsappUrl("Hola, me gustaría información sobre tarjetas regalo");

const GiftCardHighlight = () => {
  const { t } = useI18n();

  return (
    <section className="section-padding bg-terracotta-light">
      <div className="container-narrow text-center">
        <Gift size={32} className="mx-auto mb-4 text-primary" />
        <h2 className="font-display text-3xl md:text-4xl mb-4">{t.giftCard.title}</h2>
        <p className="text-sm text-muted-foreground font-body leading-relaxed mb-8 max-w-md mx-auto">
          {t.giftCard.description}
        </p>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm font-body bg-primary text-primary-foreground px-6 py-3 rounded transition-opacity hover:opacity-90"
        >
          {t.giftCard.cta}
        </a>
      </div>
    </section>
  );
};

export default GiftCardHighlight;
