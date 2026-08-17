/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@/i18n/context";
import {
  DEFAULT_REVIEW_SETTINGS,
  type Review,
  type ReviewDisplaySettings,
  type ReviewSyncStateRow,
} from "@/lib/reviews";

const h = vi.hoisted(() => ({
  updateEq: vi.fn(async () => ({ data: null, error: null as null | { message: string } })),
  update: vi.fn((_v: Record<string, unknown>) => ({ eq: h.updateEq, neq: h.updateEq })),
  settingsUpdate: vi.fn((_v: Record<string, unknown>) => ({ eq: h.updateEq, neq: h.updateEq })),
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), message: vi.fn() },
  state: {
    items: [] as Review[],
    settings: null as unknown as ReviewDisplaySettings,
    syncState: [] as ReviewSyncStateRow[],
    missingTable: false,
    isPending: false,
    isError: false,
    hasSettingsRow: true,
  },
}));

vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn(async () => ({ data: { status: "ok" }, error: null })) } },
}));
vi.mock("@/integrations/supabase/pending-reviews", async (orig) => {
  const actual = await orig<typeof import("@/integrations/supabase/pending-reviews")>();
  return {
    ...actual,
    reviewsTable: () => ({ update: h.update }),
    reviewSettingsTable: () => ({ update: h.settingsUpdate }),
    reviewSyncStateTable: () => ({ select: () => ({ order: async () => ({ data: [], error: null }) }) }),
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
  last_synced_at: null,
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
  h.state.syncState = [];
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

describe("dashboard reviews — per-source status", () => {
  it("shows persistent status and counters for each source", () => {
    h.state.syncState = [
      {
        source: "google",
        last_attempt_at: "2026-02-01T10:00:00Z",
        last_success_at: "2026-02-01T10:00:00Z",
        status: "ok",
        imported_count: 3,
        updated_count: 2,
        skipped_count: 1,
        error_code: null,
        error_message: null,
        updated_at: "",
      },
    ];
    mount();
    expect(screen.getByTestId("sync-status-google").textContent).toMatch(/connected|conectado|подключено/i);
    expect(screen.getByTestId("sync-counters-google").textContent).toMatch(/3/);
    // TripAdvisor is not a synced source at all — there is no sync row for it.
    expect(screen.queryByTestId("sync-status-tripadvisor")).toBeNull();
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
    // No sync button and no source toggle for TripAdvisor anywhere.
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
