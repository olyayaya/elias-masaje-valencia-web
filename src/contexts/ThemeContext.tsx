import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

export type ThemeDirection = "warm" | "clinical" | "natural" | "editorial" | "organic";

interface ThemeContextType {
  theme: ThemeDirection;
  setTheme: (theme: ThemeDirection) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<ThemeDirection>(() => {
    const saved = localStorage.getItem("theme-direction") as ThemeDirection | null;
    return saved && ["warm", "clinical", "natural", "editorial"].includes(saved) ? saved : "warm";
  });

  const setTheme = useCallback((t: ThemeDirection) => {
    setThemeState(t);
    localStorage.setItem("theme-direction", t);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};
