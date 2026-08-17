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
  {
    id: "img-2",
    collection_key: "home_carousel",
    image_url: "https://cdn.test/neck.webp",
    alt_text: "",
    alt_text_en: "",
    alt_text_ru: null,
    sort_order: 1,
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
    const user = userEvent.setup({ delay: null });
    render(<DashboardCarousels />);

    await user.click(await screen.findByText("Homepage Carousel"));
    const input = (await screen.findAllByLabelText(/Alt text \(ES\)/i))[0];
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

  it("drops the review when the same row is edited while the request is pending", async () => {
    const user = userEvent.setup({ delay: null });
    let release: ((v: Record<string, string>) => void) | null = null;
    vi.mocked(translateAlt).mockImplementationOnce(
      () => new Promise((res) => { release = res; }),
    );
    render(<DashboardCarousels />);
    await user.click(await screen.findByText("Homepage Carousel"));

    const input = (await screen.findAllByLabelText(/Alt text \(ES\)/i))[0];
    await user.type(input, "Masaje");
    await user.tab();
    await waitFor(() => expect(translateAlt).toHaveBeenCalledTimes(1));

    // The admin keeps typing before the answer arrives.
    await user.type(input, " de espalda");
    release!({ en: "Massage", ru: "Массаж" });

    // The late answer belongs to a value that no longer exists: no review opens.
    await waitFor(() => expect(screen.queryByLabelText("alt-ru")).not.toBeInTheDocument());
  });

  it("keeps row A's review when row B answers first (out-of-order)", async () => {
    const user = userEvent.setup({ delay: null });
    let releaseA: ((v: Record<string, string>) => void) | null = null;
    vi.mocked(translateAlt)
      .mockImplementationOnce(() => new Promise((res) => { releaseA = res; }))
      .mockImplementationOnce(async () => ({ en: "Neck massage", ru: "Массаж шеи" }));

    render(<DashboardCarousels />);
    await user.click(await screen.findByText("Homepage Carousel"));
    const inputs = await screen.findAllByLabelText(/Alt text \(ES\)/i);

    await user.type(inputs[0], "Masaje de espalda");
    await user.tab();
    await waitFor(() => expect(translateAlt).toHaveBeenCalledTimes(1));

    // Row B is saved and answers before row A.
    await user.type(inputs[1], "Masaje de cuello");
    await user.tab();
    await waitFor(() => expect(translateAlt).toHaveBeenCalledTimes(2));
    await screen.findByLabelText("alt-ru");

    // Row A's answer is still valid — its own token was never bumped.
    releaseA!({ en: "Back massage", ru: "Массаж спины" });
    await waitFor(() =>
      expect((screen.getByLabelText("alt-ru") as HTMLInputElement).value).toBe("Массаж спины"),
    );
  });
});
