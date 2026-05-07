import { MessageCircle } from "lucide-react";
import { useI18n } from "@/i18n/context";
import { WHATSAPP_URL } from "@/config/contact";
import { trackWhatsAppClick } from "@/lib/analytics";

const WhatsAppButton = () => {
  const { t } = useI18n();

  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackWhatsAppClick("floating_button")}
      className="fixed bottom-6 right-6 z-50 bg-primary text-primary-foreground w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity"
      aria-label={t.a11y.whatsappBook}
    >
      <MessageCircle size={24} />
    </a>
  );
};

export default WhatsAppButton;
