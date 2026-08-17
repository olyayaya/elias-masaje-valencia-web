/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { I18nProvider } from "@/i18n/context";
import { DEFAULT_REVIEW_SETTINGS, type Review, type ReviewDisplaySettings } from "@/lib/reviews";

const state = vi.hoisted(() => ({
  value: {
    items: [] as Review[],
    settings: null as ReviewDisplaySettings | null,
    missingTable: false,
    isPending: false,
    isError: false,
    retry: () => {},
  },
}));

vi.mock("@/hooks/use-reviews", () => ({ usePublicReviews: () => state.value }));

import ReviewsSection from "@/components/reviews/ReviewsSection";

const review = (p: Partial<Review>): Review => ({
  id: p.id ?? "1",
  dedupe_key: p.dedupe_key ?? "k",
  author_name: p.author_name ?? "Ana",
  rating: p.rating ?? 5,
  review_text: p.review_text ?? "Short text",
  original_language: p.original_language ?? null,
  review_text_es: p.review_text_es ?? null,
  review_text_en: p.review_text_en ?? null,
  review_text_ru: p.review_text_ru ?? null,
  reviewed_at: p.reviewed_at ?? "2026-01-01T00:00:00Z",
  original_url: p.original_url ?? null,
  visible: p.visible ?? true,
  pinned: p.pinned ?? false,
  manual_priority: p.manual_priority ?? 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "",
  imported_at: null,
});

const settings = (p: Partial<ReviewDisplaySettings> = {}): ReviewDisplaySettings => ({
  id: "s",
  updated_at: "",
  ...DEFAULT_REVIEW_SETTINGS,
  ...p,
});

const mount = () => render(<I18nProvider><ReviewsSection /></I18nProvider>);

beforeEach(() => {
  state.value = {
    items: [],
    settings: settings(),
    missingTable: false,
    isPending: false,
    isError: false,
    retry: () => {},
  };
});
afterEach(cleanup);

describe("public reviews section", () => {
  it("renders nothing at all when there are no reviews", () => {
    const { container } = mount();
    expect(container.textContent).toBe("");
    expect(screen.queryByTestId("reviews-section")).toBeNull();
  });

  it("renders nothing when the table is missing — no legacy cards", () => {
    state.value.missingTable = true;
    state.value.items = [review({ id: "a" })];
    const { container } = mount();
    expect(container.textContent).toBe("");
  });

  it("renders nothing while loading and nothing on error — never a skeleton or an error box", () => {
    state.value.items = [review({ id: "a" })];
    state.value.isPending = true;
    expect(mount().container.textContent).toBe("");
    cleanup();
    state.value.isPending = false;
    state.value.isError = true;
    expect(mount().container.textContent).toBe("");
  });

  it("renders nothing when the owner disabled the section", () => {
    state.value.items = [review({ id: "a" })];
    state.value.settings = settings({ section_enabled: false });
    const { container } = mount();
    expect(container.textContent).toBe("");
  });

  it("renders one card per review, without duplicates", () => {
    state.value.items = [review({ id: "a" }), review({ id: "b", author_name: "Bea" })];
    mount();
    expect(screen.getAllByTestId("review-card")).toHaveLength(2);
  });

  it("hides 1–4★ by default and shows them once allowed", () => {
    state.value.items = [review({ id: "a", rating: 5 }), review({ id: "b", rating: 4, author_name: "Bea" })];
    mount();
    expect(screen.getAllByTestId("review-card")).toHaveLength(1);
    cleanup();
    state.value.settings = settings({ allowed_ratings: [4, 5] });
    mount();
    expect(screen.getAllByTestId("review-card")).toHaveLength(2);
  });

  it("puts pinned first and honours the persisted manual order", () => {
    state.value.items = [
      review({ id: "a", author_name: "Ana", manual_priority: 1 }),
      review({ id: "b", author_name: "Bea", manual_priority: 9 }),
      review({ id: "p", author_name: "Pia", pinned: true, manual_priority: -5 }),
    ];
    state.value.settings = settings({ sort_mode: "manual" });
    mount();
    const names = screen.getAllByTestId("review-card").map((el) => el.textContent);
    expect(names[0]).toContain("Pia");
    expect(names[1]).toContain("Bea");
    expect(names[2]).toContain("Ana");
  });

  it("links the original only when the owner stored one, and never a platform profile", () => {
    state.value.items = [
      review({ id: "a", original_url: "https://maps.example/review/a" }),
      review({ id: "b", author_name: "Bea", original_url: null }),
    ];
    state.value.settings = settings({ sort_mode: "manual" });
    mount();
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe("https://maps.example/review/a");
    expect(links[0].getAttribute("target")).toBe("_blank");
    expect(links[0].getAttribute("rel")).toContain("noopener");
  });

  it("clamps long reviews behind a localized read-more toggle", () => {
    state.value.items = [review({ id: "a", review_text: "x".repeat(400) })];
    mount();
    const toggle = screen.getByRole("button", { name: /leer más|read more|читать полностью/i });
    const paragraph = screen.getByTestId("review-card").querySelector("p")!;
    expect(paragraph.className).toContain("line-clamp-4");
    fireEvent.click(toggle);
    expect(screen.getByTestId("review-card").querySelector("p")!.className).not.toContain("line-clamp");
  });

  it("exposes an accessible star label and semantic markup", () => {
    state.value.items = [review({ id: "a", rating: 5 })];
    const { container } = mount();
    expect(container.querySelector("blockquote")).toBeTruthy();
    expect(container.querySelector("cite")!.textContent).toBe("Ana");
    expect(container.querySelector('[role="img"]')!.getAttribute("aria-label")).toMatch(/5/);
  });
});

describe("no platform branding and no invented data", () => {
  it("shows no source badge for Google, TripAdvisor or anyone else", () => {
    state.value.items = [review({ id: "a", original_url: "https://maps.example/x" })];
    mount();
    expect(document.body.textContent).not.toMatch(/google|tripadvisor/i);
  });

  it("skips an incomplete row instead of inventing a name", () => {
    state.value.items = [review({ id: "a", author_name: "" }), review({ id: "b", author_name: "Bea" })];
    mount();
    const cards = screen.getAllByTestId("review-card");
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain("Bea");
    expect(document.body.textContent).not.toMatch(/google user/i);
  });
});

describe("localized review text on the public page", () => {
  const translated = review({
    id: "t",
    review_text: "Fantastic massage from Elias!",
    original_language: "en",
    review_text_es: "¡Un masaje fantástico de Elias!",
    review_text_en: "Fantastic massage from Elias!",
    review_text_ru: "Потрясающий массаж у Элиаса!",
  });

  afterEach(() => window.history.pushState({}, "", "/"));

  it("shows the Spanish text and the note on the Spanish page", () => {
    state.value.items = [translated];
    mount();
    expect(screen.getByTestId("review-card").textContent).toContain("¡Un masaje fantástico de Elias!");
    expect(screen.getByTestId("review-translated-note").textContent).toBe("Traducido del original");
  });

  it("shows the untouched original and no note in the original language", () => {
    window.history.pushState({}, "", "/en");
    state.value.items = [translated];
    mount();
    expect(screen.getByTestId("review-card").textContent).toContain("Fantastic massage from Elias!");
    expect(screen.queryByTestId("review-translated-note")).toBeNull();
  });

  it("shows the Russian text and the Russian note on the Russian page", () => {
    window.history.pushState({}, "", "/ru");
    state.value.items = [translated];
    mount();
    expect(screen.getByTestId("review-card").textContent).toContain("Потрясающий массаж у Элиаса!");
    expect(screen.getByTestId("review-translated-note").textContent).toBe("Перевод оригинала");
  });

  it("falls back to the original without a note when a translation is missing", () => {
    window.history.pushState({}, "", "/ru");
    state.value.items = [review({ id: "f", review_text: "Genial", original_language: "es" })];
    mount();
    expect(screen.getByTestId("review-card").textContent).toContain("Genial");
    expect(screen.queryByTestId("review-translated-note")).toBeNull();
  });

  it("labels a mixed-language original as translated in every language", () => {
    state.value.items = [
      review({
        id: "m",
        review_text: "Great service / Muy buen servicio",
        original_language: "mul",
        review_text_es: "Muy buen servicio",
        review_text_en: "Great service",
        review_text_ru: "Отличный сервис",
      }),
    ];
    mount();
    expect(screen.getByTestId("review-card").textContent).toContain("Muy buen servicio");
    expect(screen.getByTestId("review-translated-note")).toBeTruthy();
  });

  it("clamps on the length of the shown translation, not the original", () => {
    state.value.items = [
      review({ id: "c", review_text: "short", original_language: "en", review_text_es: "x".repeat(400) }),
    ];
    mount();
    expect(screen.getByTestId("review-card").querySelector("p")!.className).toContain("line-clamp-4");
  });
});
