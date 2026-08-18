/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@/i18n/context";
import { ThemeProvider } from "@/contexts/ThemeContext";

/**
 * Public gallery reads: only published rows reach visitors, a real read error is
 * NOT silently flattened into "empty", and the grid renders thumbnails that fall
 * back to the original object when the storage transform fails.
 */

const rows = [
  { id: "g1", media_url: "https://cdn.test/a.webp", published: true, sort_order: 1 },
  { id: "g2", media_url: "https://cdn.test/b.webp", published: true, sort_order: 2 },
  { id: "g3", media_url: "https://cdn.test/hidden.webp", published: false, sort_order: 3 },
];

const h = vi.hoisted(() => ({ error: null as null | { code?: string; message: string } }));

const full = (r: (typeof rows)[number]) => ({
  id: r.id,
  media_type: "photo",
  media_url: r.media_url,
  poster_url: "",
  title_es: "", title_en: "", title_ru: "",
  description_es: "", description_en: "", description_ru: "",
  alt_es: "Foto", alt_en: "Photo", alt_ru: "Фото",
  sort_order: r.sort_order,
  published: r.published,
  duration_seconds: null,
  thumbnail_x: 50,
  thumbnail_y: 50,
  thumbnail_zoom: 1,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
});

vi.mock("@/integrations/supabase/client", () => {
  const build = (publishedOnly: { value: boolean }) => {
    const chain: Record<string, unknown> = {};
    const result = () => {
      if (h.error) return { data: null, error: h.error };
      const data = rows.filter((r) => (publishedOnly.value ? r.published : true)).map(full);
      return { data, error: null };
    };
    chain.select = () => chain;
    chain.eq = (_c: string, _v: unknown) => {
      publishedOnly.value = true;
      return chain;
    };
    chain.order = (_c: string, _o: unknown) => ({
      ...chain,
      order: () => Promise.resolve(result()),
      then: (res: (v: unknown) => void) => res(result()),
    });
    return chain;
  };
  return { supabase: { from: () => build({ value: false }) } };
});

import { useGallery } from "@/hooks/use-gallery";
import GaleriaPage from "@/pages/Galeria";

const Probe = () => {
  const { data, isError } = useGallery();
  return <div data-testid="probe">{isError ? "error" : data.map((i) => i.id).join(",")}</div>;
};

const wrap = (ui: React.ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <ThemeProvider>
          <MemoryRouter>{ui}</MemoryRouter>
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>,
  );

beforeEach(() => {
  h.error = null;
});
afterEach(cleanup);

describe("public gallery visibility", () => {
  it("returns only published items, in sort order", async () => {
    wrap(<Probe />);
    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("g1,g2"));
  });

  it("surfaces a real read error instead of pretending the gallery is empty", async () => {
    h.error = { code: "42501", message: "permission denied" };
    wrap(<Probe />);
    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("error"));
  });

  it("renders published photos in the public grid with an original-URL fallback", async () => {
    wrap(<GaleriaPage />);
    const imgs = await screen.findAllByRole("img");
    expect(imgs).toHaveLength(2);
    expect(imgs[0].getAttribute("data-full-src")).toBe("https://cdn.test/a.webp");
  });
});
