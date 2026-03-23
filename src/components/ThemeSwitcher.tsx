import { useState, useRef, useEffect } from "react";
import { Palette } from "lucide-react";
import { useTheme, type ThemeDirection } from "@/contexts/ThemeContext";

const themes: { id: ThemeDirection; label: string; color: string }[] = [
  { id: "warm", label: "Warm Minimal", color: "hsl(16 40% 55%)" },
  { id: "clinical", label: "Clinical Premium", color: "hsl(220 55% 35%)" },
  { id: "natural", label: "Natural Modern", color: "hsl(90 30% 38%)" },
];

const ThemeSwitcher = () => {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="fixed bottom-6 left-6 z-50">
      {open && (
        <div className="absolute bottom-16 left-0 bg-background border border-border rounded-lg shadow-soft py-2 min-w-[180px] animate-in fade-in slide-in-from-bottom-2 duration-200">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTheme(t.id); setOpen(false); }}
              className={`flex items-center gap-3 w-full text-left px-4 py-2.5 text-sm font-body transition-colors hover:bg-secondary ${
                t.id === theme ? "text-primary font-medium" : "text-muted-foreground"
              }`}
            >
              <span
                className="w-4 h-4 rounded-full shrink-0 border border-border"
                style={{ backgroundColor: t.color }}
              />
              {t.label}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="w-12 h-12 rounded-full bg-foreground text-background flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity"
        aria-label="Switch theme direction"
      >
        <Palette size={20} />
      </button>
    </div>
  );
};

export default ThemeSwitcher;
