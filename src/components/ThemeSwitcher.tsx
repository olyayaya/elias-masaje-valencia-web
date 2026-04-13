import { Sun, Moon, Sparkles } from "lucide-react";
import { useTheme, ThemeMode } from "@/contexts/ThemeContext";

const modeIcons: Record<ThemeMode, typeof Sun> = {
  light: Moon,
  dark: Sparkles,
  "dark-gradient": Sun,
};

const modeLabels: Record<ThemeMode, string> = {
  light: "Switch to dark mode",
  dark: "Switch to dark gradient mode",
  "dark-gradient": "Switch to light mode",
};

const ThemeSwitcher = () => {
  const { mode, toggleMode } = useTheme();
  const Icon = modeIcons[mode];

  return (
    <div className="fixed bottom-6 left-6 z-50">
      <button
        onClick={toggleMode}
        className="w-11 h-11 rounded-full bg-foreground/90 text-background flex items-center justify-center shadow-lg hover:bg-foreground transition-all hover:-translate-y-0.5"
        aria-label={modeLabels[mode]}
      >
        <Icon size={17} />
      </button>
    </div>
  );
};

export default ThemeSwitcher;
