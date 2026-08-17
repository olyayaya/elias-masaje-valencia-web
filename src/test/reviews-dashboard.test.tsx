/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@/i18n/context";
import {
  DEFAULT_REVIEW_SETTINGS,
  type Review,
  type ReviewDisplaySettings,
} from "@/lib/reviews";

const h = vi.hoisted(() => ({
  updateEq: vi.fn(async () => ({ data: null, error: null as null | { message: string } })),
  update: vi.fn((_v: Record<string, unknown>) => ({ eq: h.updateEq, neq: h.updateEq })),
  settingsUpdate: vi.fn((_v: Record<string, unknown>) => ({ eq: h.updateEq, neq: h.updateEq })),
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), message: vi.fn() },
  state: {
    items: [] as Review[],
    settings: null as unknown as ReviewDisplaySettings,
    missingTable: false,
    isPending: false,
    isError: false,
    hasSettingsRow: true,
  },
}));

vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("@/integrations/supabase/pending-reviews", async (orig) => {
  const actual = await orig<typeof import("@/integrations/supabase/pending-reviews")>();
  return {
    ...actual,
    reviewsTable: () => ({ update: h.update }),
    reviewSettingsTable: () => ({ update: h.settingsUpdate }),
  };
});
vi.mock("@/hooks/use-reviews", async (orig) => {
  const actual = await orig<typeof import("@/hooks/use-reviews")>();
  return { ...actual, useAdminReviews: () => h.state };
});

import DashboardReviews from "@/components/dashboard/DashboardReviews";

const review = (p: Partial<Review>): Review => ({
  id: p.id ?? "1",
  source: p.source ?? "google",
  external_review_id: "x",
  author_name: p.author_name ?? "Ana",
  author_avatar_url: null,
  rating: p.rating ?? 5,
  review_text: p.review_text ?? "text",
  review_language: null,
  reviewed_at: "2026-01-01T00:00:00Z",
  original_url: null,
  visible: p.visible ?? true,
  pinned: p.pinned ?? false,
  manual_priority: p.manual_priority ?? 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "",
  imported_at: null,
});

const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <DashboardReviews />
      </I18nProvider>
    </QueryClientProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  h.updateEq.mockImplementation(async () => ({ data: null, error: null }));
  h.state.items = [
    review({ id: "a", author_name: "Ana", rating: 5, source: "google" }),
    review({ id: "b", author_name: "Bea", rating: 3, source: "manual", visible: false }),
  ];
  h.state.settings = { id: "s", updated_at: "", ...DEFAULT_REVIEW_SETTINGS };
  h.state.missingTable = false;
});
afterEach(cleanup);

describe("dashboard reviews — filters", () => {
  it("filters by search, source, rating and visibility", () => {
    mount();
    expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(2);

    fireEvent.change(screen.getByLabelText(/search|buscar|поиск/i), { target: { value: "bea" } });
    expect(screen.getAllByRole("heading", { level: 4 })[0].textContent).toBe("Bea");

    fireEvent.change(screen.getByLabelText(/search|buscar|поиск/i), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(/all sources|todas las fuentes|все источники/i), {
      target: { value: "google" },
    });
    expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(1);

    fireEvent.change(screen.getByLabelText(/all sources|todas las fuentes|все источники/i), { target: { value: "all" } });
    fireEvent.change(screen.getByLabelText(/all ratings|todas las valoraciones|все оценки/i), { target: { value: "3" } });
    expect(screen.getAllByRole("heading", { level: 4 })[0].textContent).toBe("Bea");

    fireEvent.change(screen.getByLabelText(/all ratings|todas las valoraciones|все оценки/i), { target: { value: "all" } });
    fireEvent.change(screen.getByLabelText(/visible and hidden|visibles y ocultas|видимые и скрытые/i), {
      target: { value: "hidden" },
    });
    expect(screen.getAllByRole("heading", { level: 4 })[0].textContent).toBe("Bea");
  });
});

describe("dashboard reviews — moderation", () => {
  it("toggles visibility and pinning", async () => {
    mount();
    fireEvent.click(screen.getAllByLabelText(/hide from site|ocultar de la web|скрыть с сайта/i)[0]);
    await waitFor(() => expect(h.update).toHaveBeenCalledWith({ visible: false }));
    fireEvent.click(screen.getAllByLabelText(/pin to the top|fijar arriba|закрепить сверху/i)[0]);
    await waitFor(() => expect(h.update).toHaveBeenCalledWith({ pinned: true }));
  });

  it("nudges the manual order value", async () => {
    mount();
    fireEvent.click(screen.getAllByLabelText(/move up|subir|поднять/i)[0]);
    await waitFor(() => expect(h.update).toHaveBeenCalledWith({ manual_priority: 1 }));
    fireEvent.click(screen.getAllByLabelText(/move down|bajar|опустить/i)[0]);
    await waitFor(() => expect(h.update).toHaveBeenCalledWith({ manual_priority: -1 }));
  });
});

describe("dashboard reviews — persisted display settings", () => {
  it("starts with only 5★ enabled and persists a rating band change", async () => {
    mount();
    const four = screen.getByLabelText(/4★/);
    expect((four as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText(/5★/) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(four);
    await waitFor(() => expect(h.settingsUpdate).toHaveBeenCalledWith({ allowed_ratings: [4, 5] }));
  });

  it("persists source toggles and the homepage sort mode", async () => {
    mount();
    fireEvent.click(screen.getByLabelText(/show reviews from google|mostrar reseñas de google|отзывы из google/i));
    await waitFor(() =>
      expect(h.settingsUpdate).toHaveBeenCalledWith({ allowed_sources: ["manual"] }),
    );

    fireEvent.change(screen.getByLabelText(/order on the homepage|orden en la portada|порядок на главной/i), {
      target: { value: "manual" },
    });
    await waitFor(() => expect(h.settingsUpdate).toHaveBeenCalledWith({ sort_mode: "manual" }));
  });

  it("keeps the list-only sort separate from the persisted homepage order", () => {
    mount();
    fireEvent.change(screen.getByLabelText(/order in this list only|solo en esta lista|только в этом списке/i), {
      target: { value: "rating_low" },
    });
    expect(screen.getAllByRole("heading", { level: 4 })[0].textContent).toBe("Bea");
    expect(h.settingsUpdate).not.toHaveBeenCalled();
  });
});

describe("dashboard reviews — no automated sync surface", () => {
  it("offers no sync button, no provider status and no secret names", () => {
    mount();
    expect(screen.queryByTestId("sync-status-google")).toBeNull();
    expect(screen.queryByRole("button", { name: /sync|sincroniz|синхрон/i })).toBeNull();
    expect(document.body.textContent).not.toMatch(/GOOGLE_BUSINESS/);
  });
});

describe("tripadvisor compliance card", () => {
  it("is a separate, filter-free card that only links the profile", () => {
    mount();
    const note = screen.getByTestId("tripadvisor-compliance");
    expect(note.textContent).toMatch(/widget|licen|лиценз/i);
    const link = screen.getByRole("link", { name: /tripadvisor/i });
    expect(link.getAttribute("href")).toContain(
      "tripadvisor.com/Attraction_Review-g187529-d34031094-Reviews-Elias_Massage_Valencia",
    );
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    // No import and no source toggle for TripAdvisor anywhere.
    expect(screen.queryByLabelText(/reviews from tripadvisor|reseñas de tripadvisor|отзывы из tripadvisor/i)).toBeNull();
  });

  it("offers rating bands and sources only for Google and manual reviews", () => {
    mount();
    for (const n of [1, 2, 3, 4, 5]) {
      expect(screen.getByLabelText(new RegExp(`${n}★`))).toBeTruthy();
    }
    const sourceSelect = screen.getByLabelText(/all sources|todas las fuentes|все источники/i) as HTMLSelectElement;
    expect(Array.from(sourceSelect.options).map((o) => o.value)).toEqual(["all", "google", "manual"]);
  });
});

describe("manual import — preview, dedupe and rights confirmation", () => {
  // jsdom's File has no .text(); the component reads the file that way.
  const file = (text: string, name: string) => {
    const f = new File([text], name, { type: name.endsWith(".json") ? "application/json" : "text/csv" });
    Object.defineProperty(f, "text", { value: async () => text });
    return f;
  };

  const upload = async (text: string, name = "reviews.csv") => {
    const input = screen.getByLabelText(/choose|elegir|выбрать/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file(text, name)] } });
    await waitFor(() => expect(screen.getByTestId("import-preview")).toBeTruthy());
  };

  const CSV =
    "source,external_review_id,author_name,rating,review_text,reviewed_at\n" +
    "google,x,Ana,5,Muy bien,2026-01-01\n" + // already stored (id "x")
    "google,new-1,Carla,4,Genial,2026-01-02\n" +
    "google,new-1,Carla,4,Genial,2026-01-02\n"; // duplicate inside the file

  it("previews every row and counts new, existing and in-file duplicates", async () => {
    mount();
    await upload(CSV);
    const summary = screen.getByTestId("import-summary").textContent ?? "";
    expect(summary).toMatch(/2/); // 2 valid rows
    expect(screen.getByText("Carla")).toBeTruthy();
    expect(screen.getByText("Ana")).toBeTruthy();
  });

  it("refuses to write until the rights confirmation is ticked", async () => {
    mount();
    await upload(CSV);
    const confirm = screen.getByRole("button", { name: /import 2|importar 2|импортировать 2/i });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId("import-rights"));
    expect((confirm as HTMLButtonElement).disabled).toBe(false);
  });

  it("rejects a tripadvisor source row", async () => {
    mount();
    const input = screen.getByLabelText(/choose|elegir|выбрать/i) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [
          file(
            "source,external_review_id,author_name,rating,review_text\ntripadvisor,t1,Ana,5,Nice\n",
            "ta.csv",
          ),
        ],
      },
    });
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.queryByTestId("import-preview")).toBeNull();
  });
});
