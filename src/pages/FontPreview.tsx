import { useState, useEffect } from "react";

const FONT_PAIRS = [
  {
    id: "A",
    label: "Option A",
    display: "'Playfair Display', serif",
    body: "'Inter', sans-serif",
    displayName: "Playfair Display",
    bodyName: "Inter",
    note: "High-contrast serif + neutral sans. Editorial, elegant.",
  },
  {
    id: "B",
    label: "Option B",
    display: "'Lora', serif",
    body: "'Poppins', sans-serif",
    displayName: "Lora",
    bodyName: "Poppins",
    note: "Warm readable serif + geometric sans. Soft, approachable.",
  },
  {
    id: "C",
    label: "Option C",
    display: "'Cormorant Garamond', serif",
    body: "'Source Sans 3', sans-serif",
    displayName: "Cormorant Garamond",
    bodyName: "Source Sans 3",
    note: "Light refined serif + humanist sans. Airy, premium.",
  },
];

const SAMPLE = {
  headline: "Experience the Art of Relaxation",
  subhead: "Professional massage therapy in Valencia",
  body: "Our treatments combine traditional techniques with modern wellness principles. Each session is tailored to your unique needs, helping you find balance and restore your natural vitality. We believe in the power of therapeutic touch to heal both body and mind.",
  bodyRu: "Наши процедуры сочетают традиционные техники с современными принципами оздоровления. Каждый сеанс адаптирован под ваши индивидуальные потребности, помогая обрести баланс и восстановить жизненную энергию.",
  bodyEs: "Nuestros tratamientos combinan técnicas tradicionales con principios modernos de bienestar. Cada sesión se adapta a tus necesidades únicas, ayudándote a encontrar el equilibrio.",
};

const FontPreview = () => {
  const [active, setActive] = useState("A");
  const pair = FONT_PAIRS.find((p) => p.id === active)!;

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--font-display", pair.display);
    root.style.setProperty("--font-body", pair.body);
    return () => {
      root.style.removeProperty("--font-display");
      root.style.removeProperty("--font-body");
    };
  }, [pair]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Page title */}
        <div className="mb-12" style={{ fontFamily: "'Inter', sans-serif" }}>
          <h1 className="text-2xl font-medium mb-1">Typography Preview</h1>
          <p className="text-sm text-muted-foreground">
            Compare font pairings. Click each option to preview across the page.
          </p>
        </div>

        {/* Selector */}
        <div className="flex gap-3 mb-6 flex-wrap">
          {FONT_PAIRS.map((p) => (
            <button
              key={p.id}
              onClick={() => setActive(p.id)}
              style={{ fontFamily: "'Inter', sans-serif" }}
              className={`px-6 py-2.5 rounded-full text-sm transition-all ${
                active === p.id
                  ? "bg-foreground text-background"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Font info */}
        <div className="flex flex-wrap gap-6 text-sm text-muted-foreground mb-4" style={{ fontFamily: "'Inter', sans-serif" }}>
          <div>
            <span className="text-foreground font-medium">Headlines:</span> {pair.displayName}
          </div>
          <div>
            <span className="text-foreground font-medium">Body:</span> {pair.bodyName}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-12 italic" style={{ fontFamily: "'Inter', sans-serif" }}>
          {pair.note}
        </p>

        {/* Hero preview */}
        <div className="bg-card rounded-2xl p-10 md:p-14 mb-12">
          <p
            className="text-xs tracking-[0.3em] uppercase mb-4 text-muted-foreground"
            style={{ fontFamily: pair.body }}
          >
            Valencia · Massage · Wellness
          </p>
          <div
            className="text-4xl md:text-5xl leading-[1.15] mb-5"
            style={{ fontFamily: pair.display, fontWeight: 500 }}
          >
            {SAMPLE.headline}
          </div>
          <p
            className="text-lg text-muted-foreground leading-relaxed max-w-lg mb-8"
            style={{ fontFamily: pair.body }}
          >
            {SAMPLE.subhead}
          </p>
          <span
            className="inline-block bg-foreground text-background px-8 py-3 rounded-full text-sm"
            style={{ fontFamily: pair.body }}
          >
            Book Now
          </span>
        </div>

        {/* Body text — multilingual */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div>
            <div
              className="text-2xl mb-4"
              style={{ fontFamily: pair.display, fontWeight: 500 }}
            >
              English Body Text
            </div>
            <p
              className="text-base text-muted-foreground leading-[1.85]"
              style={{ fontFamily: pair.body }}
            >
              {SAMPLE.body}
            </p>
          </div>
          <div className="space-y-6">
            <div>
              <div
                className="text-2xl mb-4"
                style={{ fontFamily: pair.display, fontWeight: 500 }}
              >
                Текст на русском
              </div>
              <p
                className="text-base text-muted-foreground leading-[1.85]"
                style={{ fontFamily: pair.body }}
              >
                {SAMPLE.bodyRu}
              </p>
            </div>
            <div>
              <div
                className="text-2xl mb-4"
                style={{ fontFamily: pair.display, fontWeight: 500 }}
              >
                Texto en español
              </div>
              <p
                className="text-base text-muted-foreground leading-[1.85]"
                style={{ fontFamily: pair.body }}
              >
                {SAMPLE.bodyEs}
              </p>
            </div>
          </div>
        </div>

        {/* Heading hierarchy */}
        <div className="border-t border-border pt-10 mb-12">
          <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] mb-6" style={{ fontFamily: pair.body }}>
            Heading Hierarchy
          </p>
          {[
            { tag: "H1", size: "text-5xl" },
            { tag: "H2", size: "text-4xl" },
            { tag: "H3", size: "text-3xl" },
            { tag: "H4", size: "text-2xl" },
          ].map((h) => (
            <div
              key={h.tag}
              className={`${h.size} mb-4`}
              style={{ fontFamily: pair.display, fontWeight: 500 }}
            >
              {h.tag} — Wellness & Relaxation
            </div>
          ))}
        </div>

        {/* Service list preview */}
        <div className="border-t border-border pt-8 space-y-0 divide-y divide-border mb-12">
          <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] mb-6 pb-0" style={{ fontFamily: pair.body }}>
            Service List
          </p>
          {["Deep Tissue Massage", "Relaxation Therapy", "Hot Stone Treatment"].map((s) => (
            <div key={s} className="flex items-center justify-between py-6">
              <div>
                <div
                  className="text-xl mb-1"
                  style={{ fontFamily: pair.display, fontWeight: 500 }}
                >
                  {s}
                </div>
                <p
                  className="text-sm text-muted-foreground"
                  style={{ fontFamily: pair.body }}
                >
                  60 min · €55
                </p>
              </div>
              <span
                className="text-sm border border-foreground/20 px-5 py-2 rounded-full"
                style={{ fontFamily: pair.body }}
              >
                Reserve
              </span>
            </div>
          ))}
        </div>

        {/* Navigation + Button preview */}
        <div className="border-t border-border pt-8 mb-12">
          <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] mb-6" style={{ fontFamily: pair.body }}>
            Navigation & Buttons
          </p>
          <div className="flex gap-6 items-center mb-6" style={{ fontFamily: pair.body }}>
            {["Home", "Services", "About", "Contact"].map((n) => (
              <span key={n} className="text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                {n}
              </span>
            ))}
          </div>
          <div className="flex gap-3 flex-wrap" style={{ fontFamily: pair.body }}>
            <span className="bg-foreground text-background px-6 py-2.5 rounded-full text-sm">
              Primary Button
            </span>
            <span className="border border-foreground/20 px-6 py-2.5 rounded-full text-sm">
              Secondary Button
            </span>
          </div>
        </div>

        {/* FAQ preview */}
        <div className="border-t border-border pt-8">
          <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] mb-6" style={{ fontFamily: pair.body }}>
            FAQ Preview
          </p>
          {["What should I expect during my first visit?", "How long does a session last?", "Do you offer gift cards?"].map((q) => (
            <div key={q} className="border-b border-border py-5">
              <div
                className="text-lg"
                style={{ fontFamily: pair.display, fontWeight: 500 }}
              >
                {q}
              </div>
              <p
                className="text-sm text-muted-foreground mt-2 leading-relaxed"
                style={{ fontFamily: pair.body }}
              >
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FontPreview;
