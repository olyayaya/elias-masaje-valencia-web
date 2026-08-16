/* @vitest-environment jsdom */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { I18nProvider } from "@/i18n/context";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Header from "@/components/Header";

const src = (p: string) => readFileSync(resolve(__dirname, "../..", p), "utf8");

const renderHeader = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>
        <I18nProvider>
          <Header />
        </I18nProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );

describe("header theme switch", () => {
  afterEach(cleanup);

  for (const path of ["/", "/en", "/ru"]) {
    it(`renders the theme control right after the language control on ${path}`, () => {
      renderHeader(path);
      const themeButtons = screen.getAllByRole("button", { name: /switch to/i });
      // one desktop + one mobile instance; only one is visible per breakpoint
      expect(themeButtons.length).toBe(2);

      for (const themeButton of themeButtons) {
        const group = themeButton.parentElement!;
        const langButton = group.querySelector('button[aria-haspopup="listbox"]');
        expect(langButton).not.toBeNull();
        // language control comes first, theme control immediately after
        expect(langButton!.compareDocumentPosition(themeButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(themeButton.getAttribute("aria-label")).toMatch(/switch to/i);
      }
    });
  }

  it("keeps the theme control out of the old floating position", () => {
    expect(src("src/components/ThemeSwitcher.tsx")).not.toContain("fixed bottom-6");
    expect(src("src/components/Layout.tsx")).not.toContain("ThemeSwitcher");
  });
});

describe("floating WhatsApp bubble removal", () => {
  it("has no WhatsAppButton component or mount", () => {
    expect(existsSync(resolve(__dirname, "../components/WhatsAppButton.tsx"))).toBe(false);
    expect(src("src/components/Layout.tsx")).not.toContain("WhatsAppButton");
  });

  it("keeps in-content WhatsApp CTAs", () => {
    expect(src("src/components/Header.tsx")).toContain("WHATSAPP_URL");
    expect(src("src/components/organic/OrganicContact.tsx")).toContain("whatsappUrl");
  });
});

describe("Instagram removal from public UI", () => {
  for (const file of [
    "src/components/Footer.tsx",
    "src/components/organic/OrganicContact.tsx",
    "src/components/Header.tsx",
  ]) {
    it(`renders no Instagram link or icon in ${file}`, () => {
      expect(src(file).toLowerCase()).not.toContain("instagram");
    });
  }

  it("keeps other social links intact", () => {
    const footer = src("src/components/Footer.tsx");
    expect(footer).toContain("Facebook");
    expect(footer).toContain("TripAdvisor");
    expect(footer).toContain("Google");
  });

  it("does not delete Instagram from settings/admin config", () => {
    expect(src("src/config/contact.ts")).toContain("INSTAGRAM_URL");
    expect(src("src/lib/site-content-meta.ts")).toContain("contact_instagram");
  });
});

describe("article typography", () => {
  it("registers the tailwind typography plugin so prose list styles exist", () => {
    const config = src("tailwind.config.ts");
    expect(config).toContain("@tailwindcss/typography");
    expect(config).toMatch(/plugins:\s*\[[^\]]*typography/);
  });

  it("declares explicit list markers on the published article renderer", () => {
    const post = src("src/pages/BlogPost.tsx");
    expect(post).toContain("prose-ul:list-disc");
    expect(post).toContain("prose-ol:list-decimal");
    expect(post).toContain('"ul","ol","li"');
  });
});
