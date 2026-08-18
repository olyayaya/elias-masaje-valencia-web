import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { parseServiceTiers } from "@/lib/service-tiers";
import BookingDialog from "@/components/BookingDialog";
import { I18nProvider } from "@/i18n/context";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ insert: () => Promise.resolve({ error: null }) }) },
}));

describe("parseServiceTiers", () => {
  it("pairs durations with prices by index", () => {
    expect(parseServiceTiers("1h / 1.5h / 2h", "50€ / 70€ / 100€")).toEqual([
      { duration: "1h", price: "50€" },
      { duration: "1.5h", price: "70€" },
      { duration: "2h", price: "100€" },
    ]);
  });

  it("does not invent options for a two-tier service", () => {
    const tiers = parseServiceTiers("1h / 1.5h", "50€ / 70€");
    expect(tiers).toHaveLength(2);
    expect(tiers[1]).toEqual({ duration: "1.5h", price: "70€" });
  });

  it("keeps a single option for single-tier services", () => {
    expect(parseServiceTiers("45 min", "40€")).toEqual([{ duration: "45 min", price: "40€" }]);
  });

  it("returns no tiers when the counts are ambiguous", () => {
    expect(parseServiceTiers("1h / 1.5h / 2h", "50€ / 70€")).toEqual([]);
  });
});

const renderDialog = () =>
  render(
    <I18nProvider>
      <BookingDialog
        service="Masaje Antiestrés"
        duration="1h / 1.5h / 2h"
        price="50€ / 70€ / 100€"
        location="test"
        triggerLabel="Reservar"
      />
    </I18nProvider>,
  );

describe("BookingDialog duration selector", () => {
  it("defaults to the first tier and updates details + message on change", async () => {
    renderDialog();
    fireEvent.click(screen.getByText("Reservar"));

    const preview = (await screen.findByLabelText(/Mensaje que se enviará|Message to be sent|Сообщение для отправки/)) as HTMLTextAreaElement;
    expect(preview.value).toContain("1h");
    expect(preview.value).toContain("50€");
    expect(preview.value).not.toContain("70€");

    const trigger = screen.getByRole("combobox");
    fireEvent.keyDown(trigger, { key: "Enter" });

    // Dropdown options show only duration, never price.
    const option = await screen.findByRole("option", { name: "1.5h" });
    expect(option.textContent).not.toContain("€");
    fireEvent.click(option);

    await waitFor(() => {
      expect(preview.value).toContain("70€");
    });
    expect(preview.value).not.toContain("100€");
  });
});
