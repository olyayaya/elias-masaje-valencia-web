/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@/i18n/context";
import { ThemeProvider } from "@/contexts/ThemeContext";
import OrganicHome from "@/components/organic/OrganicHome";

/**
 * Regression: the hero must never render the old static i18n copy while the
 * site_content request is still pending (or has failed). site_content is the
 * only source of truth for hero_headline / hero_subheadline / hero_cta.
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

const HERO_ROWS = [
  { content_key: "hero_headline", value_es: "Tu cuerpo merece atención experta", value_en: "Your body deserves expert care", value_ru: "Ваше тело заслуживает заботы" },
  { content_key: "hero_subheadline", value_es: "Masaje profesional en el corazón de Valencia", value_en: "Professional massage in the heart of Valencia", value_ru: "Профессиональный массаж в сердце Валенсии" },
  { content_key: "hero_cta", value_es: "Reservar cita", value_en: "Book an appointment", value_ru: "Записаться" },
];

const STALE = [
  "Masaje profesional\nen el centro de Valencia",
  "Un espacio para bajar el ritmo, liberar tensión y reconectar con tu cuerpo.",
  "Professional massage\nin the heart of Valencia",
  "A space to slow down, release tension, and reconnect with your body.",
  "Профессиональный массаж\nв центре Валенсии",
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

const heroText = () => document.querySelector("section")?.textContent ?? "";

const noStaleCopy = () => {
  const text = heroText();
  for (const stale of STALE) {
    expect(text).not.toContain(stale.replace(/\n/g, " "));
  }
};

describe("Hero — no stale content flash", () => {
  beforeEach(() => {
    for (const k of Object.keys(deferreds)) delete deferreds[k];
  });
  afterEach(() => cleanup());

  it.each(["/", "/en", "/ru"])("renders a skeleton and no stale hero copy while loading (%s)", async (path) => {
    setPath(path);
    renderHome(path);
    expect(await screen.findByTestId("hero-skeleton")).toBeInTheDocument();
    noStaleCopy();
    // No hero copy at all is committed to the DOM while loading.
    expect(document.querySelector("section h1")).toBeNull();
  });

  it("renders the database values once site_content resolves", async () => {
    setPath("/");
    renderHome("/");
    await screen.findByTestId("hero-skeleton");
    deferreds["site_content"].resolve({ data: HERO_ROWS, error: null });
    expect(await screen.findByText("Tu cuerpo merece atención experta")).toBeInTheDocument();
    expect(screen.getByText("Masaje profesional en el corazón de Valencia")).toBeInTheDocument();
    expect(screen.getByText("Reservar cita")).toBeInTheDocument();
    noStaleCopy();
  });

  it("renders the English database values on /en", async () => {
    setPath("/en");
    renderHome("/en");
    await screen.findByTestId("hero-skeleton");
    deferreds["site_content"].resolve({ data: HERO_ROWS, error: null });
    expect(await screen.findByText("Your body deserves expert care")).toBeInTheDocument();
    noStaleCopy();
  });

  it("renders the Russian database values on /ru", async () => {
    setPath("/ru");
    renderHome("/ru");
    await screen.findByTestId("hero-skeleton");
    deferreds["site_content"].resolve({ data: HERO_ROWS, error: null });
    expect(await screen.findByText("Ваше тело заслуживает заботы")).toBeInTheDocument();
    noStaleCopy();
  });

  it("shows a neutral error state, never stale hero copy, on failure", async () => {
    setPath("/");
    renderHome("/");
    await screen.findByTestId("hero-skeleton");
    deferreds["site_content"].reject(new Error("network"));
    await waitFor(() => expect(screen.getAllByText("Reintentar").length).toBeGreaterThan(0));
    noStaleCopy();
  });
});
