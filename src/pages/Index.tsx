import { Link } from "react-router-dom";
import heroImage from "@/assets/hero-massage.jpg";
import interiorImage from "@/assets/interior.jpg";
import aboutPortrait from "@/assets/about-portrait.jpg";
import ServiceCard from "@/components/ServiceCard";
import FaqAccordion from "@/components/FaqAccordion";
import TestimonialCard from "@/components/TestimonialCard";
import GiftCardHighlight from "@/components/GiftCardHighlight";
import MapBlock from "@/components/MapBlock";

const WHATSAPP_URL = "https://wa.me/34600000000?text=Hola%2C%20me%20gustaría%20reservar%20una%20cita";

const services = [
  {
    title: "Masaje descontracturante",
    description: "Trabajo profundo sobre nudos y tensiones musculares crónicas. Ideal para dolores de espalda y cuello.",
    duration: "60 min",
    price: "50 €",
  },
  {
    title: "Masaje relajante",
    description: "Presión suave y ritmo lento para liberar estrés acumulado y mejorar la calidad del descanso.",
    duration: "60 min",
    price: "45 €",
  },
  {
    title: "Masaje deportivo",
    description: "Preparación y recuperación muscular para deportistas. Trabajo específico por zonas.",
    duration: "45 min",
    price: "40 €",
  },
];

const faqs = [
  {
    question: "¿Necesito traer algo a la sesión?",
    answer: "No, todo el material necesario está incluido. Solo necesitas venir con ropa cómoda.",
  },
  {
    question: "¿Cuánto dura una sesión?",
    answer: "Las sesiones varían entre 45 y 90 minutos según el tratamiento elegido.",
  },
  {
    question: "¿Se puede cancelar o reprogramar?",
    answer: "Sí, puedes cancelar o cambiar tu cita con al menos 24 horas de antelación sin coste.",
  },
  {
    question: "¿Qué métodos de pago aceptáis?",
    answer: "Aceptamos efectivo, tarjeta y Bizum.",
  },
];

const testimonials = [
  { quote: "Salí como nuevo. Elias tiene unas manos increíbles y un trato muy profesional.", name: "Carlos M." },
  { quote: "El mejor masaje que he recibido en Valencia. El espacio transmite una calma total.", name: "Laura P." },
  { quote: "Después de meses con dolor de espalda, en tres sesiones noté una mejora enorme.", name: "David R." },
];

const benefits = [
  { title: "Alivio del dolor", description: "Reduce tensiones musculares y dolores crónicos de forma natural." },
  { title: "Menos estrés", description: "Baja los niveles de cortisol y mejora la calidad del sueño." },
  { title: "Mejor movilidad", description: "Aumenta la flexibilidad y el rango de movimiento articular." },
  { title: "Recuperación activa", description: "Acelera la recuperación muscular después del ejercicio." },
];

const Index = () => (
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
            Masaje profesional en el centro de Valencia
          </h1>
          <p className="text-base md:text-lg text-primary-foreground/80 font-body leading-relaxed mb-8 max-w-lg">
            Un espacio para bajar el ritmo, liberar tensión y reconectar con tu cuerpo.
          </p>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm font-body bg-primary text-primary-foreground px-7 py-3 rounded transition-opacity hover:opacity-90"
          >
            Reservar por WhatsApp
          </a>
        </div>
      </div>
    </section>

    {/* Benefits */}
    <section className="section-padding">
      <div className="container-wide">
        <h2 className="font-display text-3xl md:text-4xl text-center mb-12">Beneficios del masaje</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {benefits.map((b, i) => (
            <div key={i} className="text-center">
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
          <h2 className="font-display text-3xl md:text-4xl">Servicios</h2>
          <Link to="/servicios" className="text-sm font-body text-primary hover:opacity-80 transition-opacity">
            Ver todos →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {services.map((s, i) => (
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
            <h2 className="font-display text-3xl md:text-4xl mb-6">Sobre mí</h2>
            <p className="text-sm text-muted-foreground font-body leading-relaxed mb-4">
              Soy Elias, masajista profesional con más de 8 años de experiencia. Me formé en técnicas de masaje terapéutico, deportivo y relajante, y desde entonces he atendido a cientos de personas en Valencia.
            </p>
            <p className="text-sm text-muted-foreground font-body leading-relaxed mb-6">
              Mi enfoque combina conocimiento anatómico con una escucha activa del cuerpo. Cada sesión se adapta a lo que necesitas ese día.
            </p>
            <Link
              to="/sobre-mi"
              className="text-sm font-body text-primary hover:opacity-80 transition-opacity"
            >
              Conoce más →
            </Link>
          </div>
        </div>
      </div>
    </section>

    {/* Testimonials */}
    <section className="section-padding bg-secondary">
      <div className="container-wide">
        <h2 className="font-display text-3xl md:text-4xl text-center mb-12">Lo que dicen mis clientes</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <TestimonialCard key={i} {...t} />
          ))}
        </div>
      </div>
    </section>

    {/* Location */}
    <section className="section-padding">
      <div className="container-wide">
        <h2 className="font-display text-3xl md:text-4xl text-center mb-12">Ubicación</h2>
        <MapBlock />
      </div>
    </section>

    {/* FAQ */}
    <section className="section-padding bg-secondary">
      <div className="container-narrow">
        <h2 className="font-display text-3xl md:text-4xl text-center mb-12">Preguntas frecuentes</h2>
        <FaqAccordion items={faqs} />
      </div>
    </section>

    {/* Gift card */}
    <GiftCardHighlight />

    {/* Final CTA */}
    <section className="section-padding">
      <div className="container-narrow text-center">
        <h2 className="font-display text-3xl md:text-4xl mb-4">¿Listo para sentirte mejor?</h2>
        <p className="text-sm text-muted-foreground font-body leading-relaxed mb-8">
          Reserva tu sesión en menos de un minuto por WhatsApp.
        </p>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm font-body bg-primary text-primary-foreground px-7 py-3 rounded transition-opacity hover:opacity-90"
        >
          Reservar por WhatsApp
        </a>
      </div>
    </section>
  </div>
);

export default Index;
