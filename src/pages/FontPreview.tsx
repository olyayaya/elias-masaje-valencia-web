import { useState, type CSSProperties } from "react";

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
  {
    id: "D",
    label: "Option D",
    display: "'Fraunces', serif",
    body: "'Lexend', sans-serif",
    displayName: "Fraunces",
    bodyName: "Lexend",
    note: "Expressive variable serif + cognitive-friendly sans. Warm, distinctive.",
  },
] as const;

const SAMPLE = {
  headline: "Experience the Art of Relaxation",
  subhead: "Professional massage therapy in Valencia",
  body: "Our treatments combine traditional techniques with modern wellness principles. Each session is tailored to your unique needs, helping you find balance and restore your natural vitality. We believe in the power of therapeutic touch to heal both body and mind.",
  bodyRu:
    "Наши процедуры сочетают традиционные техники с современными принципами оздоровления. Каждый сеанс адаптирован под ваши индивидуальные потребности, помогая обрести баланс и восстановить жизненную энергию.",
  bodyEs:
    "Nuestros tratamientos combinan técnicas tradicionales con principios modernos de bienestar. Cada sesión se adapta a tus necesidades únicas, ayudándote a encontrar el equilibrio.",
};

const FontPreview = () => {
  const [active, setActive] = useState<(typeof FONT_PAIRS)[number]["id"]>("A");
  const pair = FONT_PAIRS.find((item) => item.id === active) ?? FONT_PAIRS[0];

  const previewVars = {
    "--font-display": pair.display,
    "--font-body": pair.body,
  } as CSSProperties;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-6 py-16" style={previewVars}>
        <div className="mb-12 font-body">
          <div className="mb-1 text-2xl font-medium">Typography Preview</div>
          <p className="text-sm text-muted-foreground">
            Compare font pairings. Click each option to preview across the page.
          </p>
        </div>

        <div className="mb-6 flex flex-wrap gap-3">
          {FONT_PAIRS.map((option) => {
            const isActive = active === option.id;

            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActive(option.id)}
                className={`rounded-full px-6 py-2.5 text-sm font-body transition-all ${
                  isActive
                    ? "bg-foreground text-background shadow-card"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div key={active} className="font-body">
          <div className="mb-4 flex flex-wrap gap-6 text-sm text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">Headlines:</span>{" "}
              {pair.displayName}
            </div>
            <div>
              <span className="font-medium text-foreground">Body:</span> {pair.bodyName}
            </div>
          </div>
          <p className="mb-12 text-xs italic text-muted-foreground">{pair.note}</p>

          <div className="mb-12 rounded-2xl bg-card p-10 md:p-14">
            <p className="mb-4 text-xs uppercase tracking-[0.3em] text-muted-foreground font-body">
              Valencia · Massage · Wellness
            </p>
            <div className="mb-5 text-4xl leading-[1.15] font-display md:text-5xl">
              {SAMPLE.headline}
            </div>
            <p className="mb-8 max-w-lg text-lg leading-relaxed text-muted-foreground font-body">
              {SAMPLE.subhead}
            </p>
            <span className="inline-block rounded-full bg-foreground px-8 py-3 text-sm text-background font-body">
              Book Now
            </span>
          </div>

          <div className="mb-12 grid gap-8 md:grid-cols-2">
            <div>
              <div className="mb-4 text-2xl font-display">English Body Text</div>
              <p className="text-base leading-[1.85] text-muted-foreground font-body">
                {SAMPLE.body}
              </p>
            </div>
            <div className="space-y-6">
              <div>
                <div className="mb-4 text-2xl font-display">Текст на русском</div>
                <p className="text-base leading-[1.85] text-muted-foreground font-body">
                  {SAMPLE.bodyRu}
                </p>
              </div>
              <div>
                <div className="mb-4 text-2xl font-display">Texto en español</div>
                <p className="text-base leading-[1.85] text-muted-foreground font-body">
                  {SAMPLE.bodyEs}
                </p>
              </div>
            </div>
          </div>

          <div className="mb-12 border-t border-border pt-10">
            <p className="mb-6 text-xs uppercase tracking-[0.2em] text-muted-foreground font-body">
              Heading Hierarchy
            </p>
            {[
              { tag: "H1", size: "text-5xl" },
              { tag: "H2", size: "text-4xl" },
              { tag: "H3", size: "text-3xl" },
              { tag: "H4", size: "text-2xl" },
            ].map((heading) => (
              <div key={heading.tag} className={`${heading.size} mb-4 font-display`}>
                {heading.tag} — Wellness & Relaxation
              </div>
            ))}
          </div>

          <div className="mb-12 space-y-0 divide-y divide-border border-t border-border pt-8">
            <p className="mb-6 pb-0 text-xs uppercase tracking-[0.2em] text-muted-foreground font-body">
              Service List
            </p>
            {[
              "Deep Tissue Massage",
              "Relaxation Therapy",
              "Hot Stone Treatment",
            ].map((service) => (
              <div key={service} className="flex items-center justify-between py-6">
                <div>
                  <div className="mb-1 text-xl font-display">{service}</div>
                  <p className="text-sm text-muted-foreground font-body">60 min · €55</p>
                </div>
                <span className="rounded-full border border-foreground/20 px-5 py-2 text-sm font-body">
                  Reserve
                </span>
              </div>
            ))}
          </div>

          <div className="mb-12 border-t border-border pt-8">
            <p className="mb-6 text-xs uppercase tracking-[0.2em] text-muted-foreground font-body">
              Navigation & Buttons
            </p>
            <div className="mb-6 flex items-center gap-6 font-body">
              {["Home", "Services", "About", "Contact"].map((item) => (
                <span
                  key={item}
                  className="cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 font-body">
              <span className="rounded-full bg-foreground px-6 py-2.5 text-sm text-background">
                Primary Button
              </span>
              <span className="rounded-full border border-foreground/20 px-6 py-2.5 text-sm">
                Secondary Button
              </span>
            </div>
          </div>

          <div className="border-t border-border pt-8">
            <p className="mb-6 text-xs uppercase tracking-[0.2em] text-muted-foreground font-body">
              FAQ Preview
            </p>
            {[
              "What should I expect during my first visit?",
              "How long does a session last?",
              "Do you offer gift cards?",
            ].map((question) => (
              <div key={question} className="border-b border-border py-5">
                <div className="text-lg font-display">{question}</div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground font-body">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FontPreview;
