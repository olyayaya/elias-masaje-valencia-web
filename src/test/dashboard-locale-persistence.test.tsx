/**
 * The Dashboard language is remembered per browser: it has no /en or /ru URL prefix, so
 * LocaleSync must not force ES on it, while public localized routes keep working.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider, useI18n } from "@/i18n/context";
import LocaleSync from "@/components/LocaleSync";
import {
  DASHBOARD_LOCALE_KEY, loadDashboardLocale, saveDashboardLocale, isDashboardPath,
} from "@/lib/dashboard-locale";

const Probe = () => {
  const { locale } = useI18n();
  return <span data-testid="locale">{locale}</span>;
};

const mount = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <I18nProvider>
        <LocaleSync />
        <Probe />
      </I18nProvider>
    </MemoryRouter>,
  );

const go = (path: string) => window.history.replaceState({}, "", path);

beforeEach(() => {
  localStorage.clear();
  go("/");
});

describe("dashboard locale storage", () => {
  it("defaults to es and round-trips valid locales", () => {
    expect(loadDashboardLocale()).toBe("es");
    saveDashboardLocale("ru");
    expect(loadDashboardLocale()).toBe("ru");
  });

  it("falls back to es for corrupted values", () => {
    localStorage.setItem(DASHBOARD_LOCALE_KEY, "klingon");
    expect(loadDashboardLocale()).toBe("es");
    localStorage.setItem(DASHBOARD_LOCALE_KEY, "{]");
    expect(loadDashboardLocale()).toBe("es");
  });

  it("recognises dashboard paths only", () => {
    expect(isDashboardPath("/dashboard")).toBe(true);
    expect(isDashboardPath("/dashboard/anything")).toBe(true);
    expect(isDashboardPath("/en/blog")).toBe(false);
    expect(isDashboardPath("/")).toBe(false);
  });
});

describe("dashboard keeps its language across reloads", () => {
  it.each(["en", "ru"] as const)("%s survives unmount + remount on /dashboard", (l) => {
    saveDashboardLocale(l);
    go("/dashboard?section=media");
    const first = mount("/dashboard?section=media");
    expect(screen.getByTestId("locale")).toHaveTextContent(l);
    first.unmount();

    // Simulated F5 on a different section — still the stored language, never a flash of ES.
    go("/dashboard?section=overview");
    mount("/dashboard?section=overview");
    expect(screen.getByTestId("locale")).toHaveTextContent(l);
  });

  it("LocaleSync does not reset the dashboard to es", () => {
    saveDashboardLocale("en");
    go("/dashboard");
    mount("/dashboard");
    act(() => { /* flush effects */ });
    expect(screen.getByTestId("locale")).toHaveTextContent("en");
  });

  it("invalid stored value renders es", () => {
    localStorage.setItem(DASHBOARD_LOCALE_KEY, "de");
    go("/dashboard");
    mount("/dashboard");
    expect(screen.getByTestId("locale")).toHaveTextContent("es");
  });
});

describe("public routes stay URL-driven", () => {
  it.each([
    ["/", "es"],
    ["/en/blog", "en"],
    ["/ru/galereya", "ru"],
  ])("%s → %s even with a stored dashboard locale", (path, expected) => {
    saveDashboardLocale("ru");
    go(path);
    mount(path);
    expect(screen.getByTestId("locale")).toHaveTextContent(expected);
  });
});
