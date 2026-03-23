import aboutPortrait from "@/assets/about-portrait.jpg";
import interiorImage from "@/assets/interior.jpg";

const SobreMiPage = () => (
  <div>
    {/* Hero */}
    <section className="section-padding">
      <div className="container-wide">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <img
            src={aboutPortrait}
            alt="Elias, masajista profesional en Valencia"
            className="rounded aspect-[4/5] object-cover w-full max-w-md mx-auto md:mx-0"
            loading="lazy"
            width={800}
            height={1000}
          />
          <div>
            <h1 className="font-display text-4xl md:text-5xl mb-6">Sobre mí</h1>
            <div className="space-y-4 text-sm text-muted-foreground font-body leading-relaxed">
              <p>
                Me llamo Elias y soy masajista profesional en Valencia. Llevo más de 8 años dedicándome a esto, y cada día me confirma que elegí bien.
              </p>
              <p>
                Me formé en fisioterapia y me especialicé en técnicas de masaje terapéutico, deportivo y relajante. He trabajado con deportistas, personas con dolor crónico y con quienes simplemente necesitan parar.
              </p>
              <p>
                Mi enfoque es sencillo: escuchar al cuerpo, entender lo que necesita y trabajar con precisión. No hago protocolos genéricos. Cada sesión es diferente porque cada persona lo es.
              </p>
              <p>
                El espacio donde trabajo está pensado para que te sientas tranquilo desde que llegas. Sin música alta, sin luces artificiales, sin prisas. Solo tú, tu cuerpo y el tiempo que necesitas.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* Interior image */}
    <section className="section-padding bg-secondary">
      <div className="container-wide">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="font-display text-3xl md:text-4xl mb-6">El espacio</h2>
            <div className="space-y-4 text-sm text-muted-foreground font-body leading-relaxed">
              <p>
                Mi consulta está en el centro de Valencia, en una zona tranquila y accesible. Es un espacio luminoso, cálido y diseñado para que puedas desconectar desde el primer momento.
              </p>
              <p>
                Trabajo con productos naturales y materiales de calidad. Todo está cuidado para que la experiencia sea completa y agradable.
              </p>
            </div>
          </div>
          <img
            src={interiorImage}
            alt="Interior de la consulta de masaje"
            className="rounded aspect-square object-cover w-full"
            loading="lazy"
            width={1200}
            height={800}
          />
        </div>
      </div>
    </section>
  </div>
);

export default SobreMiPage;
