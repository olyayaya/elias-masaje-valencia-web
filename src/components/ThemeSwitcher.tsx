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

/**
 * Header theme control. Rendered inline right after the language switcher so
 * both controls share the same baseline, hit area and icon size.
 */
const ThemeSwitcher = () => {
  const { mode, toggleMode } = useTheme();
  const Icon = modeIcons[mode];

  return (
    <button
      type="button"
      onClick={toggleMode}
      className="flex shrink-0 items-center justify-center w-8 h-8 -mx-1 rounded text-muted-foreground hover:text-primary-strong transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={modeLabels[mode]}
      title={modeLabels[mode]}
    >
      <Icon size={16} aria-hidden="true" />
    </button>
  );
};

export default ThemeSwitcher;
