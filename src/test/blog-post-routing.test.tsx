/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { I18nProvider } from "@/i18n/context";
import { ThemeProvider } from "@/contexts/ThemeContext";
import BlogPost from "@/pages/BlogPost";
import LocaleSync from "@/components/LocaleSync";

/**
 * Locale-specific article lookup with legacy fallback:
 *  - /en/blog/<slug_en> resolves directly;
 *  - /en/blog/<legacy slug> still resolves and is replaced (client-side, not a
 *    301) with the localized URL, canonical pointing at the localized URL.
 */

const ROW = {
  id: "post-1",
  title: "Masaje deportivo para corredores",
  title_en: "Sports massage for runners",
  title_ru: "Спортивный массаж для бегунов",
  content:
    '<p>es</p><ul><li>uno</li><li>dos<ul><li>anidado</li></ul></li></ul><ol><li>primero</li><li>segundo</li></ol>',
  content_en: "<p>en</p>",
  content_ru: "<p>ru</p>",
  meta_description: "es",
  meta_description_en: "en",
  meta_description_ru: "ru",
  seo_keywords: [],
  seo_keywords_en: [],
  seo_keywords_ru: [],
  slug: "sportivnyy-massazh-dlya-begunov-valensiya",
  slug_es: "beneficios-masaje-deportivo-corredores-valencia",
  slug_en: "sports-massage-benefits-runners-active-men-valencia",
  slug_ru: "sportivnyy-massazh-dlya-begunov-valensiya",
  published_at: "2026-05-01T10:00:00Z",
  updated_at: "2026-06-01T10:00:00Z",
};

const queries: Array<Array<[string, string]>> = [];

vi.mock("@/integrations/supabase/client", () => {
  const builder = () => {
    const filters: Array<[string, string]> = [];
    const self: Record<string, unknown> = {};
    const passthrough = () => self;
    Object.assign(self, {
      select: passthrough,
      order: passthrough,
      lte: passthrough,
      limit: passthrough,
      eq: (col: string, val: string) => {
        if (!["status", "hidden"].includes(col)) filters.push([col, val]);
        return self;
      },
      maybeSingle: async () => {
        queries.push([...filters]);
        const match = filters.some(([col, val]) => {
          const key = col as keyof typeof ROW;
          return ROW[key] === val;
        });
        return { data: match ? ROW : null, error: null };
      },
    });
    return self;
  };
  return { supabase: { from: () => builder() } };
});

const LocationProbe = () => {
  const { pathname } = useLocation();
  return <span data-testid="pathname">{pathname}</span>;
};

const renderPost = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>
        <I18nProvider>
          <LocaleSync />
          <LocationProbe />
          <Routes>
            <Route path="/en/blog/:slug" element={<BlogPost />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
          </Routes>
        </I18nProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );

const canonicalHref = () =>
  document.head.querySelector('link[rel="canonical"]')?.getAttribute("href");

describe("blog post localized routing", () => {
  beforeEach(() => {
    queries.length = 0;
    document.head.querySelectorAll('link[rel="canonical"], link[rel="alternate"]').forEach((n) => n.remove());
  });
  afterEach(cleanup);

  it("resolves an English article by slug_en and keeps the URL", async () => {
    renderPost("/en/blog/sports-massage-benefits-runners-active-men-valencia");
    await screen.findByText("Sports massage for runners");
    expect(screen.getByTestId("pathname").textContent).toBe(
      "/en/blog/sports-massage-benefits-runners-active-men-valencia",
    );
    expect(queries.flat().some(([col]) => col === "slug_en")).toBe(true);
    await waitFor(() =>
      expect(canonicalHref()).toBe(
        "https://eliasmas.es/en/blog/sports-massage-benefits-runners-active-men-valencia",
      ),
    );
  });

  it("resolves a legacy slug and replaces it with the localized URL", async () => {
    renderPost("/en/blog/sportivnyy-massazh-dlya-begunov-valensiya");
    await screen.findByText("Sports massage for runners");
    // the locale column is tried first, then the untouched legacy column
    const cols = queries.flat().map(([col]) => col);
    expect(cols).toContain("slug_en");
    expect(cols.indexOf("slug")).toBeGreaterThan(cols.indexOf("slug_en"));
    await waitFor(() =>
      expect(screen.getByTestId("pathname").textContent).toBe(
        "/en/blog/sports-massage-benefits-runners-active-men-valencia",
      ),
    );
    expect(canonicalHref()).toBe(
      "https://eliasmas.es/en/blog/sports-massage-benefits-runners-active-men-valencia",
    );
  });

  it("emits reciprocal hreflang alternates with Spanish x-default", async () => {
    renderPost("/blog/beneficios-masaje-deportivo-corredores-valencia");
    await screen.findByText("Masaje deportivo para corredores");
    await waitFor(() => {
      const alts = Array.from(document.head.querySelectorAll('link[rel="alternate"][hreflang]')).map(
        (n) => [n.getAttribute("hreflang"), n.getAttribute("href")],
      );
      expect(alts).toEqual(
        expect.arrayContaining([
          ["es", "https://eliasmas.es/blog/beneficios-masaje-deportivo-corredores-valencia"],
          ["en", "https://eliasmas.es/en/blog/sports-massage-benefits-runners-active-men-valencia"],
          ["ru", "https://eliasmas.es/ru/blog/sportivnyy-massazh-dlya-begunov-valensiya"],
          ["x-default", "https://eliasmas.es/blog/beneficios-masaje-deportivo-corredores-valencia"],
        ]),
      );
    });
  });

  it("preserves unordered, ordered and nested list markup through sanitization", async () => {
    renderPost("/blog/beneficios-masaje-deportivo-corredores-valencia");
    await screen.findByText("Masaje deportivo para corredores");
    const prose = document.querySelector(".prose")!;
    const ul = prose.querySelector("ul")!;
    const ol = prose.querySelector("ol")!;
    expect(ul).toBeTruthy();
    expect(ol).toBeTruthy();
    expect(Array.from(ul.children).filter((c) => c.tagName === "LI")).toHaveLength(2);
    expect(ul.querySelector("li ul li")!.textContent).toBe("anidado");
    expect(ol.querySelectorAll("li")).toHaveLength(2);
    expect(prose.className).toContain("prose-ul:list-disc");
    expect(prose.className).toContain("prose-ol:list-decimal");
  });
});
