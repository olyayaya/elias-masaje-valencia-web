import { MessageCircle, MapPin, Clock, Instagram } from "lucide-react";
import MapBlock from "@/components/MapBlock";
import { useI18n } from "@/i18n/context";

const WHATSAPP_URL = "https://wa.me/34600000000?text=Hola%2C%20me%20gustaría%20reservar%20una%20cita";

const ContactoPage = () => {
  const { t } = useI18n();

  return (
    <div>
      <section className="section-padding">
        <div className="container-wide">
          <h1 className="font-display text-4xl md:text-5xl mb-12">{t.contact.title}</h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-8">
              <div className="flex items-start gap-4">
                <MapPin size={20} className="text-primary mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-display text-lg mb-1">{t.contact.address}</h3>
                  <p className="text-sm text-muted-foreground font-body">{t.contact.addressValue}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <Clock size={20} className="text-primary mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-display text-lg mb-1">{t.contact.hours}</h3>
                  <div className="text-sm text-muted-foreground font-body space-y-1">
                    <p>{t.contact.weekdays}</p>
                    <p>{t.contact.saturday}</p>
                    <p>{t.contact.sunday}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <MessageCircle size={20} className="text-primary mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-display text-lg mb-1">{t.contact.whatsapp}</h3>
                  <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-sm font-body bg-primary text-primary-foreground px-6 py-2.5 rounded transition-opacity hover:opacity-90"
                  >
                    {t.contact.sendMessage}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <Instagram size={20} className="text-primary mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-display text-lg mb-1">{t.contact.instagram}</h3>
                  <a
                    href="https://instagram.com/eliasmasaje"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary font-body hover:opacity-80 transition-opacity"
                  >
                    @eliasmasaje
                  </a>
                </div>
              </div>
            </div>

            <MapBlock />
          </div>
        </div>
      </section>
    </div>
  );
};

export default ContactoPage;
