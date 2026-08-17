import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { I18nProvider } from "@/i18n/context";

const navigateSpy = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateSpy };
});

const mountAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <I18nProvider>
        <LanguageSwitcher />
      </I18nProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  navigateSpy.mockClear();
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true, writable: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const open = (getByLabelText: (t: RegExp) => HTMLElement) => {
  const trigger = getByLabelText(/idioma|language|язык/i);
  act(() => {
    trigger.click();
  });
};

describe("LanguageSwitcher scroll preservation", () => {
  it("passes preserveScroll and the current scrollY when changing language", () => {
    const { getByLabelText, getByText } = mountAt("/servicios");
    Object.defineProperty(window, "scrollY", { value: 860, configurable: true, writable: true });
    open(getByLabelText);
    act(() => {
      getByText("EN").click();
    });
    expect(navigateSpy).toHaveBeenCalledTimes(1);
    const [, options] = navigateSpy.mock.calls[0];
    expect(options.state).toEqual({ preserveScroll: true, scrollY: 860 });
  });

  it("does not navigate when the already active language is chosen", () => {
    const { getByLabelText, getAllByText } = mountAt("/servicios");
    open(getByLabelText);
    act(() => {
      // The option (not the trigger label) for the active locale.
      const options = getAllByText("ES");
      options[options.length - 1].click();
    });
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it("builds the equivalent localized path", () => {
    const { getByLabelText, getByText } = mountAt("/servicios");
    open(getByLabelText);
    act(() => {
      getByText("RU").click();
    });
    const [target] = navigateSpy.mock.calls[0];
    expect(typeof target).toBe("string");
    expect(target.startsWith("/ru")).toBe(true);
  });
});
