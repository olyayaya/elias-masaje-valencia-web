import aboutPortrait from "@/assets/about-portrait.jpg";
import interiorImage from "@/assets/interior.jpg";
import { useI18n } from "@/i18n/context";

const SobreMiPage = () => {
  const { t } = useI18n();

  return (
    <div>
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
            <div>
              <h2 className="font-display text-3xl md:text-4xl mb-6">{t.about.spaceTitle}</h2>
              <div className="space-y-4 text-sm text-muted-foreground font-body leading-relaxed">
                {t.about.spaceParagraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
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
};

export default SobreMiPage;
