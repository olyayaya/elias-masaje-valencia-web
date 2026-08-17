/* @vitest-environment jsdom */
import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@/i18n/context";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Header from "@/components/Header";

afterEach(cleanup);

const mount = (path: string) =>
  render(
    <I18nProvider>
      <ThemeProvider>
        <MemoryRouter initialEntries={[path]}>
          <Header />
        </MemoryRouter>
      </ThemeProvider>
    </I18nProvider>,
  );

const cases = [
  { path: "/", services: "/servicios", gallery: "/galeria" },
  { path: "/en", services: "/en/services", gallery: "/en/gallery" },
  { path: "/ru", services: "/ru/uslugi", gallery: "/ru/galereya" },
];

describe("gallery navigation entry", () => {
  for (const c of cases) {
    it(`sits directly after Services in the desktop nav (${c.path})`, () => {
      mount(c.path);
      const nav = screen.getAllByRole("navigation")[0];
      const hrefs = within(nav).getAllByRole("link").map((a) => a.getAttribute("href"));
      expect(hrefs).toContain(c.gallery);
      expect(hrefs[hrefs.indexOf(c.services) + 1]).toBe(c.gallery);
    });

    it(`sits directly after Services in the mobile nav (${c.path})`, () => {
      mount(c.path);
      fireEvent.click(screen.getByRole("button", { name: /men|меню/i }));
      const navs = screen.getAllByRole("navigation");
      const mobile = navs[navs.length - 1];
      const hrefs = within(mobile).getAllByRole("link").map((a) => a.getAttribute("href"));
      expect(hrefs[hrefs.indexOf(c.services) + 1]).toBe(c.gallery);
    });
  }
});

describe("header breakpoint stays on a single token", () => {
  const source = readFileSync("src/components/Header.tsx", "utf8");

  it("shows the desktop nav and hides the mobile controls at the same breakpoint", () => {
    expect(source).toContain('className="hidden lg:flex items-center gap-8"');
    expect(source).toContain('className="flex items-center gap-3 lg:hidden"');
    // No md: visibility toggle can survive alongside the lg: one, or the two navs
    // would be visible at once between 768px and 1024px.
    expect(source).not.toMatch(/hidden md:flex/);
    expect(source).not.toMatch(/md:hidden/);
  });

  it("keeps the mobile panel and its backdrop on lg as well", () => {
    expect(source).toMatch(/relative z-50 lg:hidden/);
    expect(source).toMatch(/fixed inset-0 top-16 z-40[^"]*lg:hidden/);
  });
});
