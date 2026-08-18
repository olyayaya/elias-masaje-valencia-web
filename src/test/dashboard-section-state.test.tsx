import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";

/* Every heavy section is stubbed: this suite is about routing state, not content. */
const stub = (label: string) => ({ default: () => <div>{label}</div> });
vi.mock("@/components/dashboard/DashboardOverview", () => ({ default: () => <div>OVERVIEW</div> }));
vi.mock("@/components/dashboard/DashboardMedia", () => stub("LIBRARY"));
vi.mock("@/components/dashboard/DashboardServices", () => stub("SERVICES"));
vi.mock("@/components/dashboard/DashboardBlog", () => stub("BLOG"));
vi.mock("@/components/dashboard/DashboardSEO", () => stub("SEO"));
vi.mock("@/components/dashboard/DashboardFAQ", () => stub("FAQ"));
vi.mock("@/components/dashboard/DashboardReviews", () => stub("REVIEWS"));
vi.mock("@/components/dashboard/DashboardHistory", () => stub("HISTORY"));
vi.mock("@/components/dashboard/DashboardSiteContent", () => stub("CONTENT"));
vi.mock("@/components/dashboard/DashboardPromotions", () => stub("PROMOTIONS"));
vi.mock("@/components/dashboard/DashboardCarousels", () => stub("CAROUSELS"));
vi.mock("@/components/dashboard/DashboardGallery", () => stub("GALLERY"));
vi.mock("@/components/dashboard/DashboardIntegrations", () => stub("INTEGRATIONS"));
vi.mock("@/components/dashboard/DashboardAttribution", () => stub("ATTRIBUTION"));
vi.mock("@/components/dashboard/DashboardLeads", () => stub("LEADS"));
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

  it("never renders an unknown section and falls back safely", async () => {
    mount("/dashboard?section=../../etc/passwd");
    expect(screen.getByText("OVERVIEW")).toBeInTheDocument();
    await waitFor(() => expect(lastSearch).toBe("?section=overview"));
  });
});
