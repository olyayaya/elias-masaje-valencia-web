const WHATSAPP_URL = "https://wa.me/34600000000?text=Hola%2C%20me%20gustaría%20reservar%20una%20cita";

interface ServiceCardProps {
  title: string;
  description: string;
  duration: string;
  price: string;
}

const ServiceCard = ({ title, description, duration, price }: ServiceCardProps) => (
  <div className="bg-card rounded border border-border p-6 md:p-8 flex flex-col justify-between shadow-card">
    <div>
      <h3 className="font-display text-xl md:text-2xl mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground font-body leading-relaxed mb-4">{description}</p>
      <div className="flex items-center gap-4 text-sm font-body text-muted-foreground mb-6">
        <span>{duration}</span>
        <span className="w-px h-4 bg-border" />
        <span className="font-medium text-foreground">{price}</span>
      </div>
    </div>
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block text-center text-sm font-body bg-primary text-primary-foreground px-5 py-2.5 rounded transition-opacity hover:opacity-90"
    >
      Reservar
    </a>
  </div>
);

export default ServiceCard;
