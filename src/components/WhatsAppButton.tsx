import { MessageCircle } from "lucide-react";

const WHATSAPP_URL = "https://wa.me/34600000000?text=Hola%2C%20me%20gustaría%20reservar%20una%20cita";

const WhatsAppButton = () => (
  <a
    href={WHATSAPP_URL}
    target="_blank"
    rel="noopener noreferrer"
    className="fixed bottom-6 right-6 z-50 bg-primary text-primary-foreground w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity"
    aria-label="Reservar por WhatsApp"
  >
    <MessageCircle size={24} />
  </a>
);

export default WhatsAppButton;
