import { useState } from "react";

const FONT_PAIRS = [
  {
    id: "classic",
    label: "Classic Editorial",
    display: "'Cormorant Garamond', serif",
    body: "'Inter', sans-serif",
    displayName: "Cormorant Garamond",
    bodyName: "Inter",
  },
  {
    id: "modern",
    label: "Modern Wellness",
    display: "'Playfair Display', serif",
    body: "'Manrope', sans-serif",
    displayName: "Playfair Display",
    bodyName: "Manrope",
  },
  {
    id: "refined",
    label: "Refined Elegance",
    display: "'Lora', serif",
    body: "'Inter', sans-serif",
    displayName: "Lora",
    bodyName: "Inter",
  },
];

const SAMPLE = {
  headline: "Experience the Art of Relaxation",
  subhead: "Professional massage therapy in Valencia",
  body: "Our treatments combine traditional techniques with modern wellness principles. Each session is tailored to your unique needs, helping you find balance and restore your natural vitality. We believe in the power of therapeutic touch to heal both body and mind.",
  bodyRu: "Наши процедуры сочетают традиционные техники с современными принципами оздоровления. Каждый сеанс адаптирован под ваши индивидуальные потребности.",
  bodyEs: "Nuestros tratamientos combinan técnicas tradicionales con principios modernos de bienestar. Cada sesión se adapta a tus necesidades únicas.",
};

const FontPreview = () => {
  const [active, setActive] = useState("classic");
  const pair = FONT_PAIRS.find((p) => p.id === active)!;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="font-display text-3xl mb-2">Typography Preview</div>
        <p className="text-sm text-muted-foreground font-body mb-10">
          Compare font pairings for the site. Click each option to preview.
        </p>

        {/* Selector */}
        <div className="flex gap-2 mb-12 flex-wrap">
          {FONT_PAIRS.map((p) => (
            <button
              key={p.id}
              onClick={() => setActive(p.id)}
              className={`px-5 py-2.5 rounded-full text-sm font-body transition-all ${
                active === p.id
                  ? "bg-foreground text-background"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Preview zone — override CSS variables so inherited font-family changes */}
        <div
          key={pair.id}
          style={{
            // Override the CSS custom properties used by font-display and font-body classes
            "--font-display": pair.display,
            "--font-body": pair.body,
          } as React.CSSProperties}
        >
          {/* Font info */}
          <div className="flex gap-8 text-sm text-muted-foreground font-body mb-12">
            <div>
              <span className="text-foreground font-medium">Headlines:</span> {pair.displayName}
            </div>
            <div>
              <span className="text-foreground font-medium">Body:</span> {pair.bodyName}
            </div>
          </div>

          {/* Hero preview */}
          <div className="bg-card rounded-2xl p-10 md:p-14 mb-12">
            <p className="text-xs tracking-[0.3em] uppercase mb-4 text-muted-foreground font-body">
              Valencia · Massage · Wellness
            </p>
            <div className="text-4xl md:text-5xl leading-[1.15] mb-5 font-display font-medium">
              {SAMPLE.headline}
            </div>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-lg mb-8 font-body">
              {SAMPLE.subhead}
            </p>
            <span className="inline-block bg-foreground text-background px-8 py-3 rounded-full text-sm font-body">
              Book Now
            </span>
          </div>

          {/* Body text preview */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div>
              <div className="text-2xl mb-4 font-display font-medium">
                English Body Text
              </div>
              <p className="text-base text-muted-foreground leading-[1.85] font-body">
                {SAMPLE.body}
              </p>
            </div>
            <div className="space-y-6">
              <div>
                <div className="text-2xl mb-4 font-display font-medium">
                  Текст на русском
                </div>
                <p className="text-base text-muted-foreground leading-[1.85] font-body">
                  {SAMPLE.bodyRu}
                </p>
              </div>
              <div>
                <div className="text-2xl mb-4 font-display font-medium">
                  Texto en español
                </div>
                <p className="text-base text-muted-foreground leading-[1.85] font-body">
                  {SAMPLE.bodyEs}
                </p>
              </div>
            </div>
          </div>

          {/* Service list preview */}
          <div className="border-t border-border pt-8 space-y-0 divide-y divide-border">
            {["Deep Tissue Massage", "Relaxation Therapy", "Hot Stone Treatment"].map((s) => (
              <div key={s} className="flex items-center justify-between py-6">
                <div>
                  <div className="text-xl mb-1 font-display font-medium">
                    {s}
                  </div>
                  <p className="text-sm text-muted-foreground font-body">
                    60 min · €55
                  </p>
                </div>
                <span className="text-sm border border-foreground/20 px-5 py-2 rounded-full font-body">
                  Reserve
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FontPreview;
