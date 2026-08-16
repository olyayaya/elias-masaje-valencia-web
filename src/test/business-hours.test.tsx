/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@/i18n/context";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Footer from "@/components/Footer";
import { buildLocalBusiness } from "@/lib/local-business";

/**
 * Owner-confirmed schedule: Monday–Saturday 11:00–21:00, Sunday closed.
 * Guards against reintroducing the obsolete 10:00–20:00 / Sat 10:00–14:00 hours
 * and against the footer dropping the Sunday row.
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

const HOURS_ROWS = [
  {
    content_key: "contact_weekdays",
    value_es: "Lunes a Viernes: 11:00 – 21:00",
    value_en: "Monday to Friday: 11:00 – 21:00",
    value_ru: "Понедельник – Пятница: 11:00 – 21:00",
  },
  {
    content_key: "contact_saturday",
    value_es: "Sábado: 11:00 – 21:00",
    value_en: "Saturday: 11:00 – 21:00",
    value_ru: "Суббота: 11:00 – 21:00",
  },
  {
    content_key: "contact_sunday",
    value_es: "Domingo: Cerrado",
    value_en: "Sunday: Closed",
    value_ru: "Воскресенье: Закрыто",
  },
];

const renderFooter = (path: string) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <ThemeProvider>
          <I18nProvider>
            <Footer />
          </I18nProvider>
        </ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("Footer opening hours", () => {
  beforeEach(() => {
    for (const k of Object.keys(deferreds)) delete deferreds[k];
  });
  afterEach(() => cleanup());

  it.each([
    ["/", ["Lunes a Viernes: 11:00 – 21:00", "Sábado: 11:00 – 21:00", "Domingo: Cerrado"]],
    ["/en", ["Monday to Friday: 11:00 – 21:00", "Saturday: 11:00 – 21:00", "Sunday: Closed"]],
    ["/ru", ["Понедельник – Пятница: 11:00 – 21:00", "Суббота: 11:00 – 21:00", "Воскресенье: Закрыто"]],
  ])("renders all three rows including Sunday closed (%s)", async (path, expected) => {
    window.history.pushState({}, "", path);
    renderFooter(path);
    expect(await screen.findByTestId("footer-contact-skeleton")).toBeInTheDocument();
    deferreds["site_content"].resolve({ data: HOURS_ROWS, error: null });
    for (const line of expected as string[]) {
      expect(await screen.findByText(line)).toBeInTheDocument();
    }
  });

  it("shows no stale hours while site_content is loading", () => {
    window.history.pushState({}, "", "/");
    renderFooter("/");
    const text = document.body.textContent ?? "";
    expect(text).not.toContain("10:00");
    expect(text).not.toContain("20:00");
    expect(text).not.toContain("14:00");
  });
});

describe("buildLocalBusiness opening hours", () => {
  const locales = ["es", "en", "ru"] as const;

  it.each(locales)("emits Monday–Saturday 11:00–21:00 (%s)", (locale) => {
    const spec = buildLocalBusiness(locale).openingHoursSpecification;
    const open = spec.find((s) => Array.isArray(s.dayOfWeek))!;
    expect(open.dayOfWeek).toEqual(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
    expect(open.opens).toBe("11:00");
    expect(open.closes).toBe("21:00");
  });

  it("emits Sunday closed as 00:00/00:00", () => {
    const spec = buildLocalBusiness("es").openingHoursSpecification;
    const sunday = spec.find((s) => s.dayOfWeek === "Sunday")!;
    expect(sunday.opens).toBe("00:00");
    expect(sunday.closes).toBe("00:00");
  });

  it("never contains the obsolete hour combinations", () => {
    for (const locale of locales) {
      const json = JSON.stringify(buildLocalBusiness(locale));
      expect(json).not.toContain("10:00");
      expect(json).not.toContain("20:00");
      expect(json).not.toContain("14:00");
    }
  });

  it("keeps a stable @id and identical schedule across pages (home vs contact)", () => {
    const home = buildLocalBusiness("es", { parentOrganization: true });
    const contact = buildLocalBusiness("es", { parentOrganization: false });
    expect(home["@id"]).toBe("https://eliasmas.es/#localbusiness");
    expect(contact["@id"]).toBe(home["@id"]);
    expect(contact.openingHoursSpecification).toEqual(home.openingHoursSpecification);
  });
});
