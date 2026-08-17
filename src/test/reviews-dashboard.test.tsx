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
  /** PostgREST returns the rows a mutation really wrote; the mock echoes them. */
  upsertSelect: vi.fn(async () => ({ data: null as { dedupe_key: string }[] | null, error: null as null | { message: string } })),
  upsert: vi.fn((_rows: unknown[], _o?: unknown) => ({ select: h.upsertSelect })),
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
  original_language: p.original_language ?? null,
  review_text_es: p.review_text_es ?? null,
  review_text_en: p.review_text_en ?? null,
  review_text_ru: p.review_text_ru ?? null,
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
  h.upsert.mockImplementation((rows: unknown[]) => {
    const echoed = (rows as { dedupe_key: string }[]).map((r) => ({ dedupe_key: r.dedupe_key }));
    h.upsertSelect.mockImplementation(async () => ({ data: echoed, error: null }));
    return { select: h.upsertSelect };
  });
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

  it("rejects an invalid original link instead of dropping it", async () => {
    mount();
    fireEvent.change(screen.getByLabelText(/customer name|nombre del cliente|имя клиента/i), {
      target: { value: "Nina" },
    });
    fireEvent.change(screen.getByLabelText(/review text|texto de la reseña|текст отзыва/i), {
      target: { value: "great" },
    });
    fireEvent.change(screen.getByLabelText(/link|enlace|ссылка/i), { target: { value: "http://example.com/x" } });
    fireEvent.click(screen.getByRole("button", { name: /add review|añadir reseña|добавить отзыв/i }));
    await waitFor(() => expect(screen.getByTestId("manual-error").textContent).toMatch(/https/i));
    expect(h.insert).not.toHaveBeenCalled();
  });

  it("writes once when the add button is double-clicked", async () => {
    let resolve: (v: { data: null; error: null }) => void = () => {};
    h.insert.mockImplementation(() => new Promise((r) => { resolve = r as typeof resolve; }));
    mount();
    fireEvent.change(screen.getByLabelText(/customer name|nombre del cliente|имя клиента/i), {
      target: { value: "Nina" },
    });
    fireEvent.change(screen.getByLabelText(/review text|texto de la reseña|текст отзыва/i), {
      target: { value: "great" },
    });
    const btn = screen.getByRole("button", { name: /add review|añadir reseña|добавить отзыв/i });
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => expect(h.insert).toHaveBeenCalledTimes(1));
    resolve({ data: null, error: null });
  });

  it("gives every import checkbox a 44px tap area", async () => {
    h.state.items = [];
    mount();
    await upload("author_name,rating,review_text\nA,5,one\n");
    const box = screen.getByLabelText(/select 1|seleccionar 1|выбрать 1/i);
    expect(box.parentElement?.className).toMatch(/min-h-11/);
    expect(box.parentElement?.className).toMatch(/min-w-11/);
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
    h.upsert.mockImplementation(() => ({ select: h.upsertSelect }));
    h.upsertSelect.mockImplementation(async () => ({ data: null, error: { message: "boom" } }));
    mount();
    await upload(CSV);
    fireEvent.click(screen.getByTestId("import-rights"));
    fireEvent.click(screen.getByRole("button", { name: /import 1|importar 1|импортировать 1/i }));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalled());
    const retry = await screen.findByRole("button", { name: /retry|reintentar|повторить/i });
    h.upsert.mockImplementation((rows: unknown[]) => {
    const echoed = (rows as { dedupe_key: string }[]).map((r) => ({ dedupe_key: r.dedupe_key }));
    h.upsertSelect.mockImplementation(async () => ({ data: echoed, error: null }));
    return { select: h.upsertSelect };
  });
    fireEvent.click(retry);
    await waitFor(() => expect(h.upsert).toHaveBeenCalledTimes(2));
  });

  it("imports hidden by default and only publishes when that is chosen", async () => {
    mount();
    await upload(CSV);
    // The safe option is preselected and the mode is spelled out next to the button.
    expect((screen.getByTestId("import-visible-hidden") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByTestId("import-visible-publish") as HTMLInputElement).checked).toBe(false);
    expect(screen.getByTestId("import-mode-reminder").textContent).toMatch(/hidden|ocultas|скрыт/i);

    fireEvent.click(screen.getByTestId("import-rights"));
    fireEvent.click(screen.getByRole("button", { name: /import 1|importar 1|импортировать 1/i }));
    await waitFor(() => expect(h.upsert).toHaveBeenCalledTimes(1));
    expect((h.upsert.mock.calls[0][0] as Record<string, unknown>[])[0]).toMatchObject({ visible: false });

    // Publishing straight away has to be picked deliberately.
    cleanup();
    vi.clearAllMocks();
    h.upsert.mockImplementation((rows: unknown[]) => {
      const echoed = (rows as { dedupe_key: string }[]).map((r) => ({ dedupe_key: r.dedupe_key }));
      h.upsertSelect.mockImplementation(async () => ({ data: echoed, error: null }));
      return { select: h.upsertSelect };
    });
    mount();
    await upload(CSV);
    fireEvent.click(screen.getByTestId("import-visible-publish"));
    expect(screen.getByTestId("import-mode-reminder").textContent).toMatch(/immediately|inmediat|сразу/i);
    fireEvent.click(screen.getByTestId("import-rights"));
    fireEvent.click(screen.getByRole("button", { name: /import 1|importar 1|импортировать 1/i }));
    await waitFor(() => expect(h.upsert).toHaveBeenCalledTimes(1));
    expect((h.upsert.mock.calls[0][0] as Record<string, unknown>[])[0]).toMatchObject({ visible: true });
  });

  it("ignores a visible column inside the file", async () => {
    h.state.items = [];
    mount();
    await upload("author_name,rating,review_text,visible\nZoe,5,ok,true\n");
    fireEvent.click(screen.getByTestId("import-rights"));
    fireEvent.click(screen.getByRole("button", { name: /import 1|importar 1|импортировать 1/i }));
    await waitFor(() => expect(h.upsert).toHaveBeenCalledTimes(1));
    expect((h.upsert.mock.calls[0][0] as Record<string, unknown>[])[0]).toMatchObject({ visible: false });
  });

  it("counts a row that was inserted elsewhere between preview and import as skipped", async () => {
    // The database refuses the row (ON CONFLICT DO NOTHING) → nothing returned.
    h.upsert.mockImplementation(() => ({ select: h.upsertSelect }));
    h.upsertSelect.mockImplementation(async () => ({ data: [], error: null }));
    mount();
    await upload(CSV);
    fireEvent.click(screen.getByTestId("import-rights"));
    fireEvent.click(screen.getByRole("button", { name: /import 1|importar 1|импортировать 1/i }));

    // added 0 · skipped 3 (1 already saved + 1 in-file duplicate + 1 conflict) · failed 0
    await waitFor(() => {
      expect(screen.getByTestId("import-report").textContent?.match(/\d+/g)).toEqual(["0", "3", "0"]);
    });
    // The row is now known to exist, so it drops out of the selection.
    expect(screen.getByTestId("import-selected").textContent).toMatch(/0/);
    expect(screen.getByTestId("import-row-2").textContent).toMatch(/already saved|ya guardada|уже сохранена/i);
    expect(screen.queryByRole("button", { name: /import 1|importar 1|импортировать 1/i })).toBeNull();
    expect(h.upsert).toHaveBeenCalledTimes(1);
  });

  it("reports exactly what the database wrote when only part of a batch lands", async () => {
    h.state.items = [];
    mount();
    await upload("author_name,rating,review_text\nA,5,one\nB,5,two\n");
    h.upsert.mockImplementation((rows: unknown[]) => {
      const first = (rows as { dedupe_key: string }[])[0];
      h.upsertSelect.mockImplementation(async () => ({ data: [{ dedupe_key: first.dedupe_key }], error: null }));
      return { select: h.upsertSelect };
    });
    fireEvent.click(screen.getByTestId("import-rights"));
    fireEvent.click(screen.getByRole("button", { name: /import 2|importar 2|импортировать 2/i }));
    // added 1 · skipped 1 (the conflicting one) · failed 0
    await waitFor(() => {
      expect(screen.getByTestId("import-report").textContent?.match(/\d+/g)).toEqual(["1", "1", "0"]);
    });
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

describe("manual import — pinning is an explicit choice", () => {
  const PINNED_CSV =
    "author_name,rating,review_text,featured,original_url\n" +
    "Ana,5,uno,true,https://maps.example/a\n" +
    "Bea,5,dos,false,\n";

  beforeEach(() => {
    h.state.items = [];
    h.upsert.mockImplementation((rows: unknown[]) => {
      const echoed = (rows as { dedupe_key: string }[]).map((r) => ({ dedupe_key: r.dedupe_key }));
      h.upsertSelect.mockImplementation(async () => ({ data: echoed, error: null }));
      return { select: h.upsertSelect };
    });
  });

  it("marks the original link and the file's featured flag in the preview", async () => {
    mount();
    await upload(PINNED_CSV);
    expect(screen.getByTestId("import-link-1").textContent).toMatch(/https|ссылка/i);
    expect(screen.getByTestId("import-link-2").textContent).toMatch(/no link|sin enlace|нет ссылки/i);
    expect(screen.getByTestId("import-pin-1").textContent).toMatch(/yes|sí|да/i);
    expect(screen.getByTestId("import-pin-2").textContent).toMatch(/no|нет/i);
    // The count warns before a whole featured file gets pinned by accident.
    expect(screen.getByTestId("import-pinned-count").textContent).toMatch(/1/);
  });

  it("imports unpinned by default even when the file says featured", async () => {
    mount();
    await upload(PINNED_CSV);
    expect((screen.getByTestId("import-pin-none") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByTestId("import-pin-keep") as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByTestId("import-rights"));
    fireEvent.click(screen.getByRole("button", { name: /import 2|importar 2|импортировать 2/i }));
    await waitFor(() => expect(h.upsert).toHaveBeenCalledTimes(1));
    const rows = h.upsert.mock.calls[0][0] as Record<string, unknown>[];
    expect(rows.map((r) => r.pinned)).toEqual([false, false]);
    // Visibility stays a separate, independent decision.
    expect(rows.every((r) => r.visible === false)).toBe(true);
  });

  it("keeps the file's featured flag only when that mode is picked", async () => {
    mount();
    await upload(PINNED_CSV);
    fireEvent.click(screen.getByTestId("import-pin-keep"));
    expect(screen.getByTestId("import-mode-reminder").textContent).toMatch(/featured|archivo|файла/i);
    fireEvent.click(screen.getByTestId("import-rights"));
    fireEvent.click(screen.getByRole("button", { name: /import 2|importar 2|импортировать 2/i }));
    await waitFor(() => expect(h.upsert).toHaveBeenCalledTimes(1));
    const rows = h.upsert.mock.calls[0][0] as Record<string, unknown>[];
    expect(rows.map((r) => r.pinned)).toEqual([true, false]);
    expect(rows.every((r) => r.visible === false)).toBe(true);
  });

  it("resets the pinning choice for a new file and on discard", async () => {
    mount();
    await upload(PINNED_CSV);
    fireEvent.click(screen.getByTestId("import-pin-keep"));
    await upload("author_name,rating,review_text,featured\nCleo,5,tres,true\n");
    expect((screen.getByTestId("import-pin-none") as HTMLInputElement).checked).toBe(true);

    fireEvent.click(screen.getByTestId("import-pin-keep"));
    fireEvent.click(screen.getByRole("button", { name: /discard|descartar|отменить/i }));
    await upload(PINNED_CSV);
    expect((screen.getByTestId("import-pin-none") as HTMLInputElement).checked).toBe(true);
  });
});

describe("dashboard reviews — translation editor", () => {
  it("summarizes the original language and which translations exist", () => {
    h.state.items = [
      review({ id: "a", author_name: "Ana", original_language: "en", review_text_es: "Genial" }),
    ];
    mount();
    const state = screen.getByTestId("tr-state-a").textContent!;
    expect(state).toMatch(/en/);
    expect(state).toMatch(/ES/);
    expect(state).not.toMatch(/\bRU\b/);
  });

  it("writes only the translation columns, leaving the original and the key untouched", async () => {
    h.state.items = [review({ id: "a", author_name: "Ana", review_text: "Great", original_language: null })];
    mount();
    fireEvent.click(screen.getByTestId("tr-edit-a"));
    const boxes = screen.getByTestId("tr-editor-a").querySelectorAll("textarea");
    fireEvent.change(screen.getByTestId("tr-editor-a").querySelector("input")!, { target: { value: "EN" } });
    fireEvent.change(boxes[0], { target: { value: " Genial " } });
    fireEvent.change(boxes[2], { target: { value: "Отлично" } });
    fireEvent.click(screen.getByTestId("tr-save-a"));

    await waitFor(() => expect(h.update).toHaveBeenCalled());
    const values = h.update.mock.calls.at(-1)![0];
    expect(values).toEqual({
      original_language: "en",
      review_text_es: "Genial",
      review_text_en: null,
      review_text_ru: "Отлично",
    });
    expect(values).not.toHaveProperty("review_text");
    expect(values).not.toHaveProperty("dedupe_key");
  });

  it("closes and reports success only after the row was really written", async () => {
    h.state.items = [review({ id: "a", author_name: "Ana" })];
    mount();
    fireEvent.click(screen.getByTestId("tr-edit-a"));
    fireEvent.change(screen.getByTestId("tr-editor-a").querySelectorAll("textarea")[0], {
      target: { value: "Genial" },
    });
    fireEvent.click(screen.getByTestId("tr-save-a"));

    await waitFor(() => expect(screen.queryByTestId("tr-editor-a")).toBeNull());
    expect(h.toast.success).toHaveBeenCalled();
    expect(h.toast.error).not.toHaveBeenCalled();
  });

  it("keeps the editor and the draft open on a database error, with no success toast", async () => {
    h.updateEq.mockResolvedValueOnce({ data: null, error: { message: "permission denied" } });
    h.state.items = [review({ id: "a", author_name: "Ana" })];
    mount();
    fireEvent.click(screen.getByTestId("tr-edit-a"));
    fireEvent.change(screen.getByTestId("tr-editor-a").querySelectorAll("textarea")[0], {
      target: { value: "Genial" },
    });
    fireEvent.click(screen.getByTestId("tr-save-a"));

    await waitFor(() => expect(screen.getByTestId("tr-error-a")).toBeTruthy());
    expect(screen.getByTestId("tr-editor-a")).toBeTruthy();
    expect((screen.getByTestId("tr-editor-a").querySelectorAll("textarea")[0] as HTMLTextAreaElement).value).toBe(
      "Genial",
    );
    expect(h.toast.success).not.toHaveBeenCalled();
    expect(h.toast.error).toHaveBeenCalled();
  });

  it("rejects a nonsense language tag without writing anything", () => {
    h.state.items = [review({ id: "a", author_name: "Ana" })];
    mount();
    fireEvent.click(screen.getByTestId("tr-edit-a"));
    fireEvent.change(screen.getByTestId("tr-editor-a").querySelector("input")!, { target: { value: "español!!" } });
    fireEvent.click(screen.getByTestId("tr-save-a"));
    expect(screen.getByTestId("tr-error-a")).toBeTruthy();
    expect(h.update).not.toHaveBeenCalled();
  });

  it("discards the draft on cancel", () => {
    h.state.items = [review({ id: "a", author_name: "Ana", review_text_es: "Genial" })];
    mount();
    fireEvent.click(screen.getByTestId("tr-edit-a"));
    fireEvent.change(screen.getByTestId("tr-editor-a").querySelectorAll("textarea")[0], {
      target: { value: "otro" },
    });
    fireEvent.click(screen.getByTestId("tr-cancel-a"));
    expect(screen.queryByTestId("tr-editor-a")).toBeNull();
    expect(h.update).not.toHaveBeenCalled();
    expect(h.toast.success).not.toHaveBeenCalled();
    expect(h.toast.error).not.toHaveBeenCalled();

    // Reopening shows the stored value again, never the abandoned draft.
    fireEvent.click(screen.getByTestId("tr-edit-a"));
    expect((screen.getByTestId("tr-editor-a").querySelectorAll("textarea")[0] as HTMLTextAreaElement).value).toBe(
      "Genial",
    );
  });

  it("finds a review by the text of its translation", () => {
    h.state.items = [
      review({ id: "a", author_name: "Ana", review_text: "Great", review_text_ru: "Отлично" }),
      review({ id: "b", author_name: "Bea", review_text: "Nice" }),
    ];
    mount();
    fireEvent.change(screen.getByLabelText(/search|buscar|поиск/i), { target: { value: "Отлично" } });
    const names = screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent);
    expect(names).toEqual(["Ana"]);
  });
});
