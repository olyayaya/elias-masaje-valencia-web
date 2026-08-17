/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@/i18n/context";
import { DEFAULT_REVIEW_SETTINGS, dedupeKey, type Review, type ReviewDisplaySettings } from "@/lib/reviews";

const h = vi.hoisted(() => ({
  updateEq: vi.fn(async () => ({ data: null, error: null as null | { message: string } })),
  update: vi.fn((_v: Record<string, unknown>) => ({ eq: h.updateEq, neq: h.updateEq })),
  settingsUpdate: vi.fn((_v: Record<string, unknown>) => ({ eq: h.updateEq, neq: h.updateEq })),
  upsert: vi.fn(async (_rows: unknown[], _o?: unknown) => ({ data: null, error: null as null | { message: string } })),
  insert: vi.fn(async (_rows: unknown[]) => ({ data: null, error: null as null | { message: string } })),
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
    reviewsTable: () => ({ update: h.update, upsert: h.upsert, insert: h.insert }),
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
  dedupe_key: p.dedupe_key ?? `k-${p.id ?? "1"}`,
  author_name: p.author_name ?? "Ana",
  rating: p.rating ?? 5,
  review_text: p.review_text ?? "text",
  reviewed_at: p.reviewed_at ?? "2026-01-01T00:00:00Z",
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

/** jsdom's File has no .text(); the component reads the file that way. */
const file = (text: string, name = "reviews.csv", size?: number) => {
  const f = new File([text], name, { type: name.endsWith(".json") ? "application/json" : "text/csv" });
  Object.defineProperty(f, "text", { value: async () => text });
  Object.defineProperty(f, "size", { value: size ?? text.length });
  return f;
};

const upload = async (text: string, name = "reviews.csv") => {
  const input = screen.getByLabelText(/choose|elegir|выбрать/i) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file(text, name)] } });
  await waitFor(() => expect(screen.getByTestId("import-preview")).toBeTruthy());
};

beforeEach(() => {
  vi.clearAllMocks();
  h.updateEq.mockImplementation(async () => ({ data: null, error: null }));
  h.upsert.mockImplementation(async () => ({ data: null, error: null }));
  h.insert.mockImplementation(async () => ({ data: null, error: null }));
  h.state.items = [
    review({ id: "a", author_name: "Ana", rating: 5 }),
    review({ id: "b", author_name: "Bea", rating: 3, visible: false }),
  ];
  h.state.settings = { id: "s", updated_at: "", ...DEFAULT_REVIEW_SETTINGS };
  h.state.missingTable = false;
});
afterEach(cleanup);

describe("dashboard reviews — filters", () => {
  it("filters by search, rating and visibility", () => {
    mount();
    expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(2);

    fireEvent.change(screen.getByLabelText(/search|buscar|поиск/i), { target: { value: "bea" } });
    expect(screen.getAllByRole("heading", { level: 4 })[0].textContent).toBe("Bea");

    fireEvent.change(screen.getByLabelText(/search|buscar|поиск/i), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(/all ratings|todas las valoraciones|все оценки/i), { target: { value: "3" } });
    expect(screen.getAllByRole("heading", { level: 4 })[0].textContent).toBe("Bea");

    fireEvent.change(screen.getByLabelText(/all ratings|todas las valoraciones|все оценки/i), { target: { value: "all" } });
    fireEvent.change(screen.getByLabelText(/visible and hidden|visibles y ocultas|видимые и скрытые/i), {
      target: { value: "hidden" },
    });
    expect(screen.getAllByRole("heading", { level: 4 })[0].textContent).toBe("Bea");
  });

  it("offers no source filter at all", () => {
    mount();
    expect(screen.queryByLabelText(/all sources|todas las fuentes|все источники/i)).toBeNull();
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

  it("persists the homepage sort mode and keeps no source toggles", async () => {
    mount();
    expect(screen.queryByLabelText(/reviews from|reseñas de google|отзывы из/i)).toBeNull();
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

describe("dashboard reviews — no automated integration surface", () => {
  it("offers no sync button, no provider status and no secret names", () => {
    mount();
    expect(screen.queryByTestId("sync-status-google")).toBeNull();
    expect(screen.queryByRole("button", { name: /sync|sincroniz|синхрон/i })).toBeNull();
    expect(document.body.textContent).not.toMatch(/GOOGLE_BUSINESS|API key|clave de API|ключ API/);
  });

  it("keeps the platform profiles as plain links with a no-import explanation", () => {
    mount();
    expect(screen.getByTestId("reviews-profiles-note").textContent).toMatch(/never downloaded|no se descarga|не загружается/i);
    for (const name of [/google/i, /tripadvisor/i]) {
      const link = screen.getByRole("link", { name });
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
    }
  });
});

describe("manual entry", () => {
  it("saves a hand-typed review hidden, with a content dedupe key", async () => {
    mount();
    fireEvent.change(screen.getByLabelText(/customer name|nombre del cliente|имя клиента/i), {
      target: { value: "Carla" },
    });
    fireEvent.change(screen.getByLabelText(/review text|texto de la reseña|текст отзыва/i), {
      target: { value: "Muy bien" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add review|añadir reseña|добавить отзыв/i }));
    await waitFor(() => expect(h.insert).toHaveBeenCalled());
    const row = (h.insert.mock.calls[0][0] as Record<string, unknown>[])[0];
    expect(row).toMatchObject({ author_name: "Carla", review_text: "Muy bien", rating: 5, visible: false });
    expect(row.dedupe_key).toBe(dedupeKey({ author_name: "Carla", review_text: "Muy bien", reviewed_at: null }));
  });

  it("refuses a duplicate of a review already stored", async () => {
    const key = dedupeKey({ author_name: "Ana", review_text: "text", reviewed_at: null });
    h.state.items = [review({ id: "a", author_name: "Ana", review_text: "text", dedupe_key: key })];
    mount();
    fireEvent.change(screen.getByLabelText(/customer name|nombre del cliente|имя клиента/i), {
      target: { value: "Ana" },
    });
    fireEvent.change(screen.getByLabelText(/review text|texto de la reseña|текст отзыва/i), {
      target: { value: "text" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add review|añadir reseña|добавить отзыв/i }));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalled());
    expect(h.insert).not.toHaveBeenCalled();
  });
});

describe("manual import — preview, selection and rights confirmation", () => {
  const stored = dedupeKey({ author_name: "Ana", review_text: "Muy bien", reviewed_at: "2026-01-01T00:00:00.000Z" });
  const CSV =
    "author_name,rating,review_text,reviewed_at\n" +
    "Ana,5,Muy bien,2026-01-01\n" + // already stored
    "Carla,4,Genial,2026-01-02\n" +
    "Carla,4,Genial,2026-01-02\n" + // duplicate inside the file
    "Dora,9,Mal,2026-01-03\n"; // invalid rating

  beforeEach(() => {
    h.state.items = [review({ id: "a", author_name: "Ana", review_text: "Muy bien", dedupe_key: stored })];
  });

  it("previews every row with its status and counts", async () => {
    mount();
    await upload(CSV);
    expect(screen.getByTestId("import-summary").textContent?.match(/\d+/g)).toEqual(["4", "1", "1", "1", "1"]);
    expect(screen.getByTestId("import-row-4").textContent).toMatch(/1.*5|1 to 5|1 a 5|1 до 5/);
  });

  it("selects importable rows only and supports ctrl and shift selection", async () => {
    h.state.items = [];
    mount();
    await upload(
      "author_name,rating,review_text\nA,5,one\nB,5,two\nC,5,three\nD,5,four\n",
    );
    // All four importable rows start selected.
    expect(screen.getByTestId("import-selected").textContent).toMatch(/4/);
    fireEvent.click(screen.getByRole("button", { name: /clear selection|quitar selección|снять выбор/i }));
    expect(screen.getByTestId("import-selected").textContent).toMatch(/0/);

    fireEvent.click(screen.getByTestId("import-row-2"));
    fireEvent.click(screen.getByTestId("import-row-4"), { shiftKey: true });
    expect(screen.getByTestId("import-selected").textContent).toMatch(/3/);

    fireEvent.click(screen.getByTestId("import-row-1"), { ctrlKey: true });
    expect(screen.getByTestId("import-selected").textContent).toMatch(/4/);

    fireEvent.keyDown(screen.getByTestId("import-row-1"), { key: " " });
    expect(screen.getByTestId("import-selected").textContent).toMatch(/3/);
  });

  it("never selects duplicate or invalid rows", async () => {
    mount();
    await upload(CSV);
    expect(screen.getByTestId("import-selected").textContent).toMatch(/1/);
    fireEvent.click(screen.getByRole("button", { name: /select all|seleccionar todas|выбрать все/i }));
    expect(screen.getByTestId("import-selected").textContent).toMatch(/1/);
    fireEvent.click(screen.getByTestId("import-row-3")); // in-file duplicate
    fireEvent.click(screen.getByTestId("import-row-4")); // invalid
    expect(screen.getByTestId("import-selected").textContent).toMatch(/1/);
  });

  it("refuses to write until the rights confirmation is ticked", async () => {
    mount();
    await upload(CSV);
    const confirm = screen.getByRole("button", { name: /import 1|importar 1|импортировать 1/i });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId("import-rights"));
    expect((confirm as HTMLButtonElement).disabled).toBe(false);
  });

  it("inserts with conflict-ignore on the dedupe key and reports the result", async () => {
    mount();
    await upload(CSV);
    fireEvent.click(screen.getByTestId("import-rights"));
    fireEvent.click(screen.getByRole("button", { name: /import 1|importar 1|импортировать 1/i }));
    await waitFor(() => expect(h.upsert).toHaveBeenCalledTimes(1));
    const [rows, options] = h.upsert.mock.calls[0];
    expect(options).toEqual({ onConflict: "dedupe_key", ignoreDuplicates: true });
    expect(rows).toHaveLength(1);
    expect((rows as Record<string, unknown>[])[0]).toMatchObject({ author_name: "Carla" });
    await waitFor(() => expect(screen.getByTestId("import-report").textContent).toMatch(/1/));
  });

  it("keeps failed rows retryable instead of losing them", async () => {
    h.upsert.mockImplementation(async () => ({ data: null, error: { message: "boom" } }));
    mount();
    await upload(CSV);
    fireEvent.click(screen.getByTestId("import-rights"));
    fireEvent.click(screen.getByRole("button", { name: /import 1|importar 1|импортировать 1/i }));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalled());
    const retry = await screen.findByRole("button", { name: /retry|reintentar|повторить/i });
    h.upsert.mockImplementation(async () => ({ data: null, error: null }));
    fireEvent.click(retry);
    await waitFor(() => expect(h.upsert).toHaveBeenCalledTimes(2));
  });

  it("stops an oversized file before reading it", async () => {
    mount();
    const input = screen.getByLabelText(/choose|elegir|выбрать/i) as HTMLInputElement;
    const big = file("author_name,rating,review_text\nA,5,x\n", "big.csv", 5 * 1024 * 1024);
    fireEvent.change(input, { target: { files: [big] } });
    await waitFor(() => expect(screen.getByTestId("import-file-errors")).toBeTruthy());
    expect(screen.queryByTestId("import-preview")).toBeNull();
  });
});
