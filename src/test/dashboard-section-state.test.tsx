import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";

/* Every heavy section is stubbed: this suite is about routing state, not content. */
vi.mock("@/components/dashboard/DashboardOverview", () => ({ default: () => <div>OVERVIEW</div> }));
vi.mock("@/components/dashboard/DashboardMedia", () => ({ default: () => <div>LIBRARY</div> }));
vi.mock("@/components/dashboard/DashboardServices", () => ({ default: () => <div>SERVICES</div> }));
vi.mock("@/components/dashboard/DashboardBlog", () => ({ default: () => <div>BLOG</div> }));
vi.mock("@/components/dashboard/DashboardSEO", () => ({ default: () => <div>SEO</div> }));
vi.mock("@/components/dashboard/DashboardFAQ", () => ({ default: () => <div>FAQ</div> }));
vi.mock("@/components/dashboard/DashboardReviews", () => ({ default: () => <div>REVIEWS</div> }));
vi.mock("@/components/dashboard/DashboardHistory", () => ({ default: () => <div>HISTORY</div> }));
vi.mock("@/components/dashboard/DashboardSiteContent", () => ({ default: () => <div>CONTENT</div> }));
vi.mock("@/components/dashboard/DashboardPromotions", () => ({ default: () => <div>PROMOTIONS</div> }));
vi.mock("@/components/dashboard/DashboardCarousels", () => ({ default: () => <div>CAROUSELS</div> }));
vi.mock("@/components/dashboard/DashboardGallery", () => ({ default: () => <div>GALLERY</div> }));
vi.mock("@/components/dashboard/DashboardIntegrations", () => ({ default: () => <div>INTEGRATIONS</div> }));
vi.mock("@/components/dashboard/DashboardAttribution", () => ({ default: () => <div>ATTRIBUTION</div> }));
vi.mock("@/components/dashboard/DashboardLeads", () => ({ default: () => <div>LEADS</div> }));
vi.mock("@/components/dashboard/OnboardingDialog", () => ({ default: () => null }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signOut: vi.fn() } },
}));

import Dashboard from "@/pages/Dashboard";
import { I18nProvider } from "@/i18n/context";
import { ThemeProvider } from "@/contexts/ThemeContext";

let lastSearch = "";
const Probe = () => {
  lastSearch = useLocation().search;
  return null;
};

const mount = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <I18nProvider>
        <ThemeProvider>
          <Probe />
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </ThemeProvider>
      </I18nProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  localStorage.clear();
  lastSearch = "";
});

describe("dashboard section persistence", () => {
  it("writes ?section=media when the Library menu item is clicked", async () => {
    const user = userEvent.setup();
    mount("/dashboard");
    expect(await screen.findByText("OVERVIEW")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /Library|Biblioteca|Библиотека/ })[0]);
    await screen.findByText("LIBRARY");
    expect(lastSearch).toBe("?section=media");
  });

  it("renders the Library immediately on a reload of ?section=media, never Overview first", () => {
    mount("/dashboard?section=media");
    expect(screen.getByText("LIBRARY")).toBeInTheDocument();
    expect(screen.queryByText("OVERVIEW")).not.toBeInTheDocument();
  });

  it("restores the last section for a legacy /dashboard without the parameter", async () => {
    localStorage.setItem("elias.dashboard.section", "gallery");
    mount("/dashboard");
    expect(screen.getByText("GALLERY")).toBeInTheDocument();
    await waitFor(() => expect(lastSearch).toBe("?section=gallery"));
  });

  it("expands the More group when a secondary section is restored", () => {
    mount("/dashboard?section=integrations");
    expect(screen.getByText("INTEGRATIONS")).toBeInTheDocument();
    // The sibling secondary items are only rendered while the group is open.
    expect(screen.getAllByRole("button", { name: /History|Historial|История/ }).length).toBeGreaterThan(0);
  });

  it("keeps More expanded while a secondary section is active and restores the choice after", async () => {
    const user = userEvent.setup();
    mount("/dashboard?section=integrations");
    const more = screen.getByRole("button", { name: /More/ });
    expect(more).toBeDisabled();
    // Clicking cannot hide the active item.
    await user.click(more).catch(() => {});
    expect(screen.getAllByRole("button", { name: /History|Historial|История/ }).length).toBeGreaterThan(0);

    // Back on a primary section the user's own collapsed preference applies again.
    await user.click(screen.getAllByRole("button", { name: /Library|Biblioteca|Библиотека/ })[0]);
    await screen.findByText("LIBRARY");
    expect(screen.getByRole("button", { name: /More/ })).not.toBeDisabled();
    expect(screen.queryByRole("button", { name: /History|Historial|История/ })).not.toBeInTheDocument();
  });

  it("never renders an unknown section and falls back safely", async () => {
    mount("/dashboard?section=../../etc/passwd");
    expect(screen.getByText("OVERVIEW")).toBeInTheDocument();
    await waitFor(() => expect(lastSearch).toBe("?section=overview"));
  });
});
