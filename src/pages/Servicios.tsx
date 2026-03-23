import ServiceCard from "@/components/ServiceCard";
import serviceImage from "@/assets/service-detail.jpg";

const allServices = [
  {
    title: "Masaje descontracturante",
    description: "Trabajo profundo sobre nudos y tensiones musculares crónicas. Ideal para dolores de espalda, cuello y hombros. Se combinan técnicas de presión profunda y estiramientos.",
    duration: "60 min",
    price: "50 €",
  },
  {
    title: "Masaje relajante",
    description: "Presión suave y ritmo lento para liberar estrés acumulado y mejorar la calidad del descanso. Perfecto para desconectar del día a día.",
    duration: "60 min",
    price: "45 €",
  },
  {
    title: "Masaje deportivo",
    description: "Preparación y recuperación muscular para deportistas. Trabajo específico por zonas para prevenir lesiones y mejorar el rendimiento.",
    duration: "45 min",
    price: "40 €",
  },
  {
    title: "Masaje de espalda y cuello",
    description: "Sesión focalizada en las zonas donde más se acumula la tensión. Ideal si trabajas muchas horas sentado o frente al ordenador.",
    duration: "30 min",
    price: "30 €",
  },
  {
    title: "Masaje con ventosas",
    description: "Técnica de descompresión que mejora la circulación, reduce inflamación y alivia el dolor muscular profundo.",
    duration: "45 min",
    price: "45 €",
  },
  {
    title: "Sesión combinada",
    description: "Combinación personalizada de técnicas según tus necesidades. Evaluación previa incluida para diseñar un tratamiento a medida.",
    duration: "90 min",
    price: "70 €",
  },
];

const ServiciosPage = () => (
  <div>
    {/* Hero */}
    <section className="section-padding bg-secondary">
      <div className="container-wide">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="font-display text-4xl md:text-5xl mb-6">Servicios</h1>
            <p className="text-sm text-muted-foreground font-body leading-relaxed">
              Cada sesión se adapta a tu cuerpo y a lo que necesitas ese día. Estos son los tratamientos que ofrezco en mi centro del centro de Valencia.
            </p>
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

    {/* Services list */}
    <section className="section-padding">
      <div className="container-wide">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allServices.map((s, i) => (
            <ServiceCard key={i} {...s} />
          ))}
        </div>
      </div>
    </section>
  </div>
);

export default ServiciosPage;
