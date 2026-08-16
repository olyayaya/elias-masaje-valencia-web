/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@/i18n/context";
import { ThemeProvider } from "@/contexts/ThemeContext";
import OrganicHome from "@/components/organic/OrganicHome";

/**
 * Regression: homepage internal CTA links must be locale-aware.
 * English and Russian visitors should stay on their language paths.
 */

type Deferred = { promise: Promise<unknown>; resolve: (v: unknown) => void; reject: (e: unknown) => void };
const deferreds: Record<string, Deferred> = {};

const makeDeferred = (): Deferred => {
  let resolve!: (v: unknown) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

vi.mock("@/integrations/supabase/client", () => {
  const builder = (table: string) => {
    const d = (deferreds[table] ??= makeDeferred());
    const chain: Record<string, unknown> = {};
    const self = new Proxy(chain, {
      get(_target, prop) {
        if (prop === "then") return (...args: unknown[]) => (d.promise as Promise<unknown>).then(...(args as []));
        return () => self;
      },
    });
    return self;
  };
  return { supabase: { from: (table: string) => builder(table) } };
});

const SITE_CONTENT_ROWS = [
  { content_key: "hero_headline", value_es: "Tu cuerpo merece atención experta", value_en: "Your body deserves expert care", value_ru: "Ваше тело заслуживает заботы" },
  { content_key: "hero_subheadline", value_es: "Masaje profesional en el corazón de Valencia", value_en: "Professional massage in central Valencia", value_ru: "Профессиональный массаж в сердце Валенсии" },
  { content_key: "hero_cta", value_es: "Reservar cita", value_en: "Book an appointment", value_ru: "Записаться" },
  { content_key: "about_preview_p1", value_es: "Soy Elias, masajista profesional en Valencia.", value_en: "I am Elias, a professional massage therapist in Valencia.", value_ru: "Я Элиас, профессиональный массажист в Валенсии." },
  { content_key: "about_preview_p2", value_es: "Cada sesión se adapta a ti.", value_en: "Every session is tailored to you.", value_ru: "Каждая сессия адаптируется под вас." },
  { content_key: "location_title", value_es: "Ubicación", value_en: "Location", value_ru: "Расположение" },
  { content_key: "gift_card_title", value_es: "Regala bienestar", value_en: "Gift wellness", value_ru: "Подарите здоровье" },
  { content_key: "gift_card_description", value_es: "Una experiencia única.", value_en: "A unique experience.", value_ru: "Уникальный опыт." },
  { content_key: "gift_card_cta", value_es: "Comprar", value_en: "Buy", value_ru: "Купить" },
  { content_key: "final_cta_title", value_es: "¿Listo para sentirte mejor?", value_en: "Ready to feel better?", value_ru: "Готовы почувствовать себя лучше?" },
  { content_key: "final_cta_description", value_es: "Reserva ahora.", value_en: "Book now.", value_ru: "Запишитесь сейчас." },
  { content_key: "final_cta_button", value_es: "Reservar por WhatsApp", value_en: "Book via WhatsApp", value_ru: "Записаться через WhatsApp" },
];

const SERVICES_ROWS = [
  { id: "1", title: "Masaje relajante", description: "Descanso profundo.", duration: "60 min", price: "60", hide_price: false, hide_duration: false, hide_price_from: false },
];

const renderHome = (path: string) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <ThemeProvider>
          <I18nProvider>
            <OrganicHome />
          </I18nProvider>
        </ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const setPath = (path: string) => {
  window.history.pushState({}, "", path);
};

describe("Homepage — locale-aware internal CTAs", () => {
  beforeEach(() => {
    for (const k of Object.keys(deferreds)) delete deferreds[k];
  });
  afterEach(() => cleanup());

  it.each([
    { path: "/", expectedServices: "/servicios", expectedAbout: "/sobre-mi" },
    { path: "/en", expectedServices: "/en/services", expectedAbout: "/en/about" },
    { path: "/ru", expectedServices: "/ru/uslugi", expectedAbout: "/ru/about" },
  ])("renders locale-aware CTA hrefs for $path", async ({ path, expectedServices, expectedAbout }) => {
    setPath(path);
    renderHome(path);

    deferreds["site_content"]?.resolve({ data: SITE_CONTENT_ROWS, error: null });
    deferreds["services"]?.resolve({ data: SERVICES_ROWS, error: null });
    deferreds["faqs"]?.resolve({ data: [], error: null });
    deferreds["testimonials"]?.resolve({ data: [], error: null });
    deferreds["page_images"]?.resolve({ data: [], error: null });

    const servicesLink = await screen.findByRole("link", { name: /Ver todos|View all|Смотреть все/i });
    const aboutLink = await screen.findByRole("link", { name: /Conoce más|Learn more|Узнать больше/i });

    expect(servicesLink).toHaveAttribute("href", expectedServices);
    expect(aboutLink).toHaveAttribute("href", expectedAbout);
  });

  it.each(["/en", "/ru"])("never points %s CTAs to Spanish routes", async (path) => {
    setPath(path);
    renderHome(path);

    deferreds["site_content"]?.resolve({ data: SITE_CONTENT_ROWS, error: null });
    deferreds["services"]?.resolve({ data: SERVICES_ROWS, error: null });
    deferreds["faqs"]?.resolve({ data: [], error: null });
    deferreds["testimonials"]?.resolve({ data: [], error: null });
    deferreds["page_images"]?.resolve({ data: [], error: null });

    const links = await screen.findAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href"));

    expect(hrefs).not.toContain("/servicios");
    expect(hrefs).not.toContain("/sobre-mi");
  });
});
