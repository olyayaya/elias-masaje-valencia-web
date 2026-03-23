import ServiceCard from "@/components/ServiceCard";
import serviceImage from "@/assets/service-detail.jpg";
import { useI18n } from "@/i18n/context";

const ServiciosPage = () => {
  const { t } = useI18n();

  return (
    <div>
      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="font-display text-4xl md:text-5xl mb-6">{t.services.title}</h1>
              <p className="text-sm text-muted-foreground font-body leading-relaxed">{t.services.pageSubtitle}</p>
            </div>
            <img
              src={serviceImage}
              alt="Detalle de productos de masaje"
              className="rounded aspect-[4/3] object-cover w-full"
              loading="lazy"
              width={800}
              height={600}
            />
          </div>
        </div>
      </section>

      <section className="section-padding">
        <div className="container-wide">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {t.services.items.map((s, i) => (
              <ServiceCard key={i} {...s} index={i} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default ServiciosPage;
