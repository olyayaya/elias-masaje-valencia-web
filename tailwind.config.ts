import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        body: ['var(--font-body)', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        terracotta: {
          DEFAULT: "hsl(var(--terracotta))",
          light: "hsl(var(--terracotta-light))",
          dark: "hsl(var(--terracotta-dark))",
        },
        warm: {
          cream: "hsl(var(--warm-cream))",
          stone: "hsl(var(--warm-stone))",
          brown: "hsl(var(--warm-brown))",
        },
        "organic-dark": {
          DEFAULT: "hsl(var(--organic-dark))",
          foreground: "hsl(var(--organic-dark-foreground))",
          muted: "hsl(var(--organic-dark-muted))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        card: "var(--shadow-card)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "hero-breathe": {
          "0%, 100%": { opacity: "0.85" },
          "50%": { opacity: "0.55" },
        },
        "hero-text-breathe": {
          "0%, 100%": {
            "text-shadow": "0 0 0 transparent",
            filter: "contrast(1) brightness(1)",
            transform: "scale(1)",
          },
          "50%": {
            "text-shadow": "0 2px 24px hsl(var(--background) / 0.8), 0 0 40px hsl(var(--background) / 0.3)",
            filter: "contrast(1.2) brightness(1.08)",
            transform: "scale(1.008)",
          },
        },
        "hero-zoom": {
          "0%": { transform: "scale(1.08)" },
          "100%": { transform: "scale(1)" },
        },
        "organic-breathe": {
          "0%, 100%": { transform: "scale(1)", opacity: "0.7" },
          "50%": { transform: "scale(1.12)", opacity: "1" },
        },
        "organic-float": {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "33%": { transform: "translateY(-8px) rotate(1.5deg)" },
          "66%": { transform: "translateY(4px) rotate(-1deg)" },
        },
        "organic-drift": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "25%": { transform: "translate(6px, -4px) scale(1.04)" },
          "50%": { transform: "translate(-3px, -8px) scale(1.08)" },
          "75%": { transform: "translate(-6px, 2px) scale(1.02)" },
        },
        "heading-breathe": {
          "0%, 100%": {
            opacity: "1",
            "letter-spacing": "0em",
          },
          "50%": {
            opacity: "0.85",
            "letter-spacing": "0.02em",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "hero-text-breathe": "hero-text-breathe 6s ease-in-out infinite",
        "hero-breathe": "hero-breathe 6s ease-in-out infinite",
        "hero-zoom": "hero-zoom 1.8s cubic-bezier(0.25, 0.1, 0.25, 1) forwards",
        "organic-breathe": "organic-breathe 6s ease-in-out infinite",
        "organic-float": "organic-float 8s ease-in-out infinite",
        "organic-drift": "organic-drift 10s ease-in-out infinite",
        "heading-breathe": "heading-breathe 7s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
