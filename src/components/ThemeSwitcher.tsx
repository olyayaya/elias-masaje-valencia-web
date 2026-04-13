import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

const ThemeSwitcher = () => {
  const { mode, toggleMode } = useTheme();

  return (
    <button
      onClick={toggleMode}
      className="fixed bottom-6 left-6 z-50 w-11 h-11 rounded-full bg-foreground/90 text-background flex items-center justify-center shadow-lg hover:bg-foreground transition-all hover:-translate-y-0.5"
      aria-label={mode === "light" ? "Switch to dark mode" : "Switch to light mode"}
    >
      {mode === "light" ? <Moon size={17} /> : <Sun size={17} />}
    </button>
  );
};

export default ThemeSwitcher;
