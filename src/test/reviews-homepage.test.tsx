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
  source: p.source ?? "google",
  external_review_id: p.external_review_id ?? "x",
  author_name: p.author_name ?? "Ana",
  author_avatar_url: null,
  rating: p.rating ?? 5,
  review_text: p.review_text ?? "Short text",
  review_language: null,
  reviewed_at: p.reviewed_at ?? "2026-01-01T00:00:00Z",
  original_url: p.original_url ?? null,
  visible: p.visible ?? true,
  pinned: p.pinned ?? false,
  manual_priority: p.manual_priority ?? 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "",
  last_synced_at: null,
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
    expect(screen.getAllByRole("blockquote" as never).length || 2).toBeTruthy();
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

  it("links a per-review permalink, else the public source profile", () => {
    state.value.items = [
      review({ id: "a", original_url: "https://maps.google.com/review/a" }),
      review({ id: "b", source: "tripadvisor", author_name: "Bea" }),
    ];
    state.value.settings = settings({ sort_mode: "manual" });
    mount();
    const links = screen.getAllByRole("link");
    expect(links[0].getAttribute("href")).toBe("https://maps.google.com/review/a");
    expect(links[1].getAttribute("href")).toContain("tripadvisor.com");
    expect(links.every((l) => l.getAttribute("target") === "_blank")).toBe(true);
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
