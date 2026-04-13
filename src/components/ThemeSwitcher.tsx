import { useState } from "react";
import { Sun, Moon, Type, X } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT_PAIRS } from "@/config/fontPairs";

const ThemeSwitcher = () => {
  const { mode, toggleMode, fontPairId, setFontPairId } = useTheme();
  const [showFonts, setShowFonts] = useState(false);

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col-reverse items-start gap-2">
      {/* Dark/Light toggle */}
      <button
        onClick={toggleMode}
        className="w-11 h-11 rounded-full bg-foreground/90 text-background flex items-center justify-center shadow-lg hover:bg-foreground transition-all hover:-translate-y-0.5"
        aria-label={mode === "light" ? "Switch to dark mode" : "Switch to light mode"}
      >
        {mode === "light" ? <Moon size={17} /> : <Sun size={17} />}
      </button>

      {/* Font toggle button */}
      <button
        onClick={() => setShowFonts(!showFonts)}
        className="w-11 h-11 rounded-full bg-foreground/90 text-background flex items-center justify-center shadow-lg hover:bg-foreground transition-all hover:-translate-y-0.5"
        aria-label="Switch font"
      >
        {showFonts ? <X size={17} /> : <Type size={17} />}
      </button>

      {/* Font options panel */}
      {showFonts && (
        <div className="bg-card border border-border rounded-lg shadow-soft p-3 min-w-[200px] max-w-[240px]">
          <p className="text-xs font-body text-muted-foreground mb-2 uppercase tracking-wider">Typography</p>
          <div className="flex flex-col gap-1">
            {FONT_PAIRS.map((pair) => (
              <button
                key={pair.id}
                onClick={() => setFontPairId(pair.id)}
                className={`text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  pair.id === fontPairId
                    ? "bg-primary/15 text-primary"
                    : "text-foreground hover:bg-secondary"
                }`}
              >
                <span className="font-medium">{pair.id}</span>
                <span className="text-muted-foreground ml-1.5 text-xs">
                  {pair.displayName} + {pair.bodyName}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeSwitcher;
