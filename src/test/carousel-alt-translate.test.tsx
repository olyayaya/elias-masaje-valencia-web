import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const ROWS = [
  {
    id: "img-1",
    collection_key: "home_carousel",
    image_url: "https://cdn.test/back.webp",
    alt_text: "",
    alt_text_en: "Hand written",
    alt_text_ru: null,
    sort_order: 0,
  },
];

const updateSpy = vi.fn();
const eqSpy = vi.fn();

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock("@/i18n/context", () => ({ useI18n: () => ({ locale: "en" }) }));

vi.mock("@/lib/alt-translate", async () => {
  const actual = await vi.importActual<typeof import("@/lib/alt-translate")>("@/lib/alt-translate");
  return { ...actual, translateAlt: vi.fn(async () => ({ en: "Back massage", ru: "Массаж спины" })) };
});

vi.mock("@/integrations/supabase/client", () => {
  const from = () => {
    const chain: Record<string, unknown> = {};
    Object.assign(chain, {
      select: () => chain,
      order: () => Promise.resolve({ data: ROWS, error: null }),
      insert: () => Promise.resolve({ error: null }),
      delete: () => chain,
      update: (patch: unknown) => {
        updateSpy(patch);
        return {
          eq: (_col: string, id: string) => {
            eqSpy(id);
            return Promise.resolve({ error: null });
          },
        };
      },
    });
    return chain;
  };
  return { supabase: { from } };
});

vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));

const DashboardCarousels = (await import("@/components/dashboard/DashboardCarousels")).default;
const { translateAlt } = await import("@/lib/alt-translate");

describe("carousel alt auto-translation", () => {
  beforeEach(() => {
    updateSpy.mockClear();
    eqSpy.mockClear();
    vi.mocked(translateAlt).mockClear();
  });

  it("translates on save and never overwrites a manual target without confirmation", async () => {
    const user = userEvent.setup();
    render(<DashboardCarousels />);

    await user.click(await screen.findByText("Homepage Carousel"));
    const input = await screen.findByLabelText(/Alt text \(ES\)/i);
    await user.type(input, "Masaje de espalda");
    await user.tab();

    // Source column saved on its own first.
    await waitFor(() => expect(updateSpy).toHaveBeenCalledWith({ alt_text: "Masaje de espalda" }));
    await waitFor(() => expect(translateAlt).toHaveBeenCalledWith("Masaje de espalda", "es"));

    // Review dialog: RU is auto, EN keeps the human text.
    const ru = await screen.findByLabelText("alt-ru");
    expect((ru as HTMLInputElement).value).toBe("Массаж спины");
    const en = screen.getByLabelText("alt-en");
    expect((en as HTMLInputElement).value).toBe("Hand written");

    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() =>
      expect(updateSpy).toHaveBeenCalledWith({
        alt_text: "Masaje de espalda",
        alt_text_en: "Hand written",
        alt_text_ru: "Массаж спины",
      }),
    );
    // Only the edited row is touched.
    expect(new Set(eqSpy.mock.calls.map((c) => c[0]))).toEqual(new Set(["img-1"]));
  });
});
