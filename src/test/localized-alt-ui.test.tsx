import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const ROWS = [
  {
    id: "img-1",
    collection_key: "home_carousel",
    image_url: "https://cdn.test/back.webp",
    alt_text: "Masaje de espalda",
    alt_text_en: "Back massage",
    alt_text_ru: null,
    sort_order: 0,
  },
];

const updateSpy = vi.fn();

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock("@/lib/alt-translate", async () => {
  const actual = await vi.importActual<typeof import("@/lib/alt-translate")>("@/lib/alt-translate");
  return {
    ...actual,
    translateAlt: vi.fn(async () => ({ es: "Masaje de espalda", ru: "Массаж спины" })),
  };
});


vi.mock("@/integrations/supabase/client", () => {
  const builder = () => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    Object.assign(chain, {
      select: () => chain,
      eq: () => chain,
      order: () => Promise.resolve({ data: ROWS, error: null }),
      then: (res: (v: unknown) => unknown) => Promise.resolve({ data: ROWS, error: null }).then(res),
      insert: () => Promise.resolve({ error: null }),
      delete: () => chain,
      update: (patch: unknown) => {
        updateSpy(patch);
        return { eq: () => Promise.resolve({ error: null }) };
      },
      self,
    });
    return chain;
  };
  return {
    supabase: {
      from: () => builder(),
      storage: {
        from: () => ({
          list: async () => ({ data: [] }),
          getPublicUrl: (n: string) => ({ data: { publicUrl: `https://cdn.test/${n}` } }),
        }),
      },
    },
  };
});

import { I18nProvider } from "@/i18n/context";
import { usePageImages } from "@/hooks/use-page-images";
import DashboardCarousels from "@/components/dashboard/DashboardCarousels";
import ImageAltDialog from "@/components/dashboard/ImageAltDialog";
import { translateAlt } from "@/lib/alt-translate";

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <I18nProvider>{children}</I18nProvider>
    </QueryClientProvider>
  );
};

describe("public carousel alt", () => {
  it("uses the alt of the active locale and falls back to Spanish", async () => {
    window.history.replaceState({}, "", "/en");
    const en = renderHook(() => usePageImages("home_carousel"), { wrapper });
    await waitFor(() => expect(en.result.current.loaded).toBe(true));
    expect(en.result.current.images[0].alt).toBe("Back massage");

    window.history.replaceState({}, "", "/ru");
    const ru = renderHook(() => usePageImages("home_carousel"), { wrapper });
    await waitFor(() => expect(ru.result.current.loaded).toBe(true));
    expect(ru.result.current.images[0].alt).toBe("Masaje de espalda");
  });
});

describe("dashboard carousel alt editing", () => {
  beforeEach(() => updateSpy.mockClear());

  it("saves the alt of each language into its own column", async () => {
    window.history.replaceState({}, "", "/en");
    const user = userEvent.setup();
    render(<DashboardCarousels />, { wrapper });

    await user.click(await screen.findByText("Homepage Carousel"));

    // ES tab is active first — editing writes alt_text.
    const esInput = await screen.findByLabelText(/Alt text \(ES\)/i);
    await user.clear(esInput);
    await user.type(esInput, "Masaje de cuello");
    await user.tab();
    await waitFor(() => expect(updateSpy).toHaveBeenCalledWith({ alt_text: "Masaje de cuello" }));

    // Switching to RU writes only alt_text_ru.
    updateSpy.mockClear();
    await user.click(screen.getByRole("button", { name: /^RU/ }));
    const ruInput = await screen.findByLabelText(/Alt text \(RU\)/i);
    await user.type(ruInput, "Массаж шеи");
    await user.tab();
    await waitFor(() => expect(updateSpy).toHaveBeenCalledWith({ alt_text_ru: "Массаж шеи" }));
    expect(updateSpy).not.toHaveBeenCalledWith(expect.objectContaining({ alt_text: expect.anything() }));
  });
});

describe("image alt dialog", () => {
  const setup = (props: Partial<React.ComponentProps<typeof ImageAltDialog>> = {}) => {
    const onConfirm = vi.fn();
    window.history.replaceState({}, "", "/en");
    render(
      <I18nProvider>
        <ImageAltDialog
          open
          src="https://cdn.test/back.webp"
          lang="en"
          onCancel={vi.fn()}
          onConfirm={onConfirm}
          {...props}
        />
      </I18nProvider>,
    );
    return { onConfirm };
  };

  it("blocks inserting an informative image with an empty alt", async () => {
    const { onConfirm } = setup();
    const insert = screen.getByRole("button", { name: /insert image/i });
    expect(insert).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("translates first and only inserts on the second confirm", async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();
    await user.type(screen.getByLabelText(/Alt text \(EN\)/i), "Back massage");

    // First click runs the translation and keeps the dialog open for review.
    await user.click(screen.getByRole("button", { name: /insert image/i }));
    await waitFor(() => expect(translateAlt).toHaveBeenCalledWith("Back massage", "en"));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(await screen.findByLabelText("alt-ru")).toHaveValue("Массаж спины");

    await user.click(screen.getByRole("button", { name: /insert image/i }));
    expect(onConfirm).toHaveBeenCalledWith(
      "Back massage",
      false,
      expect.objectContaining({ en: "Back massage", ru: "Массаж спины" }),
    );
  });

  it("invalidates the translation when the source text changes again", async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();
    await user.type(screen.getByLabelText(/Alt text \(EN\)/i), "Back massage");
    await user.click(screen.getByRole("button", { name: /insert image/i }));
    await screen.findByLabelText("alt-ru");

    await user.type(screen.getByLabelText(/Alt text \(EN\)/i), " deep");
    expect(screen.queryByLabelText("alt-ru")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /insert image/i }));
    expect(onConfirm).not.toHaveBeenCalled();
    await waitFor(() => expect(translateAlt).toHaveBeenCalledWith("Back massage deep", "en"));
  });

  it("still lets the source language be saved when translation fails", async () => {
    const user = userEvent.setup();
    vi.mocked(translateAlt).mockRejectedValueOnce(new Error("offline"));
    const { onConfirm } = setup();
    await user.type(screen.getByLabelText(/Alt text \(EN\)/i), "Back massage");
    await user.click(screen.getByRole("button", { name: /insert image/i }));

    const only = await screen.findByRole("button", { name: /save en only/i });
    await user.click(only);
    expect(onConfirm).toHaveBeenCalledWith("Back massage", false, expect.objectContaining({ en: "Back massage" }));
  });

  it("allows an explicitly decorative image with an empty alt", async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();
    await user.click(screen.getByLabelText(/decorative image/i));
    await user.click(screen.getByRole("button", { name: /insert image/i }));
    expect(onConfirm).toHaveBeenCalledWith("", true, { es: "", en: "", ru: "" });
  });

  it("edits the alt of an already inserted image without auto-translation", async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup({ mode: "edit", initialAlt: "Old alt" });
    const input = screen.getByLabelText(/Alt text \(EN\)/i);
    expect(input).toHaveValue("Old alt");
    await user.clear(input);
    await user.type(input, "Neck massage");
    // Turning auto-translate off saves the source language straight away.
    await user.click(screen.getByLabelText(/translate/i));
    await user.click(screen.getByRole("button", { name: /save alt text/i }));
    expect(onConfirm).toHaveBeenCalledWith("Neck massage", false, expect.objectContaining({ en: "Neck massage" }));
  });
});

