import aboutPortrait from "@/assets/about-portrait.jpg";
import interiorImage from "@/assets/interior.jpg";
import massageWrist from "@/assets/massage-wrist.jpg";
import massageShoulder from "@/assets/massage-shoulder.jpg";
import { useI18n } from "@/i18n/context";
import { useFadeIn } from "@/hooks/use-fade-in";

const SobreMiPage = () => {
  const { t } = useI18n();
  const portrait = useFadeIn(0);
  const bio = useFadeIn(0.15);
  const spaceText = useFadeIn(0);
  const spaceImg = useFadeIn(0.15);

  const galleryItems = [
    { src: massageWrist, alt: "Masaje de muñeca y mano" },
    { src: massageShoulder, alt: "Masaje de hombro y espalda" },
    { src: interiorImage, alt: "Técnica de masaje profundo" },
    { src: aboutPortrait, alt: "Elias, masajista profesional" },
  ];

  return (
    <div>
      <section className="section-padding">
        <div className="container-wide">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div ref={portrait.ref} style={portrait.style}>
              <img
                src={aboutPortrait}
                alt="Elias, masajista profesional en Valencia"
                className="rounded aspect-[4/5] object-cover w-full max-w-md mx-auto md:mx-0"
                loading="lazy"
                width={800}
                height={1000}
              />
            </div>
            <div ref={bio.ref} style={bio.style}>
              <h1 className="font-display text-4xl md:text-5xl mb-6">{t.about.title}</h1>
              <div className="space-y-4 text-sm text-muted-foreground font-body leading-relaxed">
                {t.about.paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div ref={spaceText.ref} style={spaceText.style}>
              <h2 className="font-display text-3xl md:text-4xl mb-6">{t.about.spaceTitle}</h2>
              <div className="space-y-4 text-sm text-muted-foreground font-body leading-relaxed">
                {t.about.spaceParagraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>
            <div ref={spaceImg.ref} style={spaceImg.style}>
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
        </div>
      </section>

      {/* Gallery */}
      <section className="section-padding">
        <div className="container-wide">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {galleryItems.map((img, i) => {
              const anim = useFadeIn(i * 0.1);
              return (
                <div key={i} ref={anim.ref} style={anim.style}>
                  <img
                    src={img.src}
                    alt={img.alt}
                    className="rounded aspect-square object-cover w-full"
                    loading="lazy"
                    width={600}
                    height={600}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};

export default SobreMiPage;
