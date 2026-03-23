import { Gift } from "lucide-react";

const WHATSAPP_URL = "https://wa.me/34600000000?text=Hola%2C%20me%20gustaría%20información%20sobre%20tarjetas%20regalo";

const GiftCardHighlight = () => (
  <section className="section-padding bg-terracotta-light">
    <div className="container-narrow text-center">
      <Gift size={32} className="mx-auto mb-4 text-primary" />
      <h2 className="font-display text-3xl md:text-4xl mb-4">Tarjetas regalo</h2>
      <p className="text-sm text-muted-foreground font-body leading-relaxed mb-8 max-w-md mx-auto">
        Regala bienestar. Disponibles para cualquier servicio o importe personalizado.
      </p>
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block text-sm font-body bg-primary text-primary-foreground px-6 py-3 rounded transition-opacity hover:opacity-90"
      >
        Consultar por WhatsApp
      </a>
    </div>
  </section>
);

export default GiftCardHighlight;
