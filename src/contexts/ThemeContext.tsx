import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { FONT_PAIRS, type FontPair } from "@/config/fontPairs";

export type ThemeMode = "light" | "dark" | "dark-gradient";

const MODE_CYCLE: ThemeMode[] = ["light", "dark", "dark-gradient"];

interface ThemeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  fontPairId: string;
  setFontPairId: (id: string) => void;
  fontPair: FontPair;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const DEFAULT_FONT_ID = "C"; // Cormorant Garamond + Source Sans 3 (current site default)

const isValidMode = (v: string | null): v is ThemeMode =>
  v === "light" || v === "dark" || v === "dark-gradient";

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem("theme-mode");
    if (saved && isValidMode(saved)) return saved;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
    return "light";
  });

  const [fontPairId, setFontPairIdState] = useState<string>(() => {
    return localStorage.getItem("font-pair") || DEFAULT_FONT_ID;
  });

  const fontPair = FONT_PAIRS.find((p) => p.id === fontPairId) || FONT_PAIRS[0];

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    localStorage.setItem("theme-mode", m);
  }, []);

  const setFontPairId = useCallback((id: string) => {
    setFontPairIdState(id);
    localStorage.setItem("font-pair", id);
  }, []);

  const toggleMode = useCallback(() => {
    const idx = MODE_CYCLE.indexOf(mode);
    const next = MODE_CYCLE[(idx + 1) % MODE_CYCLE.length];
    setMode(next);
  }, [mode, setMode]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", mode);
  }, [mode]);

  // Apply font pair to CSS variables
  useEffect(() => {
    document.documentElement.style.setProperty("--font-display", fontPair.display);
    document.documentElement.style.setProperty("--font-body", fontPair.body);
    document.documentElement.style.setProperty("--body-font-style", fontPair.bodyItalic ? "italic" : "normal");
  }, [fontPair]);

  // Listen for system preference changes when no saved preference
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem("theme-mode")) {
        setModeState(e.matches ? "dark" : "light");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, setMode, toggleMode, fontPairId, setFontPairId, fontPair }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};
