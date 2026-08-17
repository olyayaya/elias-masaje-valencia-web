import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useNavigate } from "react-router-dom";
import ScrollToTop, { scrollKey } from "@/components/ScrollToTop";

/* Scroll behaviour: reload and Back/Forward restore, plain navigation goes up. */

const Page = ({ label }: { label: string }) => {
  const navigate = useNavigate();
  return (
    <div>
      <span>{label}</span>
      <button onClick={() => navigate("/en/gallery")}>go</button>
      <button onClick={() => navigate(-1)}>back</button>
    </div>
  );
};

const mountAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Page label="home" />} />
        <Route path="/en/gallery" element={<Page label="gallery" />} />
      </Routes>
    </MemoryRouter>,
  );

let scrollSpy: ReturnType<typeof vi.fn>;

const setNavigationType = (type: string) => {
  // performance.getEntriesByType("navigation")[0].type
  vi.spyOn(performance, "getEntriesByType").mockReturnValue([{ type }] as unknown as PerformanceEntryList);
};

beforeEach(() => {
  sessionStorage.clear();
  scrollSpy = vi.fn((x: number, y: number) => {
    Object.defineProperty(window, "scrollY", { value: y, configurable: true, writable: true });
  });
  Object.defineProperty(window, "scrollTo", { value: scrollSpy, configurable: true, writable: true });
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true, writable: true });
  setNavigationType("navigate");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ScrollToTop", () => {
  it("does not force a scroll to top on the first mount / reload", () => {
    mountAt("/");
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it("scrolls a plain in-app navigation to a new pathname up to the top, instantly", () => {
    const { getByText } = mountAt("/");
    act(() => {
      getByText("go").click();
    });
    expect(scrollSpy).toHaveBeenCalledWith(0, 0);
    // never a smooth technical scroll
    expect(scrollSpy.mock.calls.every((c) => typeof c[0] === "number")).toBe(true);
  });

  it("restores the saved position after a reload", () => {
    sessionStorage.setItem(scrollKey("/", ""), "820");
    setNavigationType("reload");
    mountAt("/");
    expect(scrollSpy).toHaveBeenCalledWith(0, 820);
  });

  it("restores the saved position on a Back/Forward step instead of going to the top", () => {
    sessionStorage.setItem(scrollKey("/", ""), "540");
    const { getByText } = mountAt("/");
    act(() => {
      getByText("go").click();
    });
    scrollSpy.mockClear();
    act(() => {
      getByText("back").click();
    });
    expect(scrollSpy).toHaveBeenCalledWith(0, 540);
    expect(scrollSpy).not.toHaveBeenCalledWith(0, 0);
  });

  it("saves the position of the page while the visitor scrolls it", () => {
    mountAt("/");
    Object.defineProperty(window, "scrollY", { value: 333, configurable: true, writable: true });
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(sessionStorage.getItem(scrollKey("/", ""))).toBe("333");
  });
});

/* ---------------- Language switch keeps the vertical position ---------------- */

const LangPage = ({ label, to }: { label: string; to: string }) => {
  const navigate = useNavigate();
  return (
    <div>
      <span>{label}</span>
      <button onClick={() => navigate(to, { state: { preserveScroll: true, scrollY: window.scrollY } })}>
        switch
      </button>
      <button onClick={() => navigate(to)}>plain</button>
      <button onClick={() => navigate(-1)}>back</button>
    </div>
  );
};

const mountLang = (from: string, to: string, at: string) =>
  render(
    <MemoryRouter initialEntries={[from]}>
      <ScrollToTop />
      <Routes>
        <Route path={from} element={<LangPage label="from" to={to} />} />
        <Route path={to} element={<LangPage label="to" to={from} />} />
        <Route path={at} element={<LangPage label="at" to={from} />} />
      </Routes>
    </MemoryRouter>,
  );

const atY = (y: number) => Object.defineProperty(window, "scrollY", { value: y, configurable: true, writable: true });

describe("language switch scroll preservation", () => {
  it.each([
    ["/", "/en", 900],
    ["/en", "/ru", 640],
    ["/ru", "/", 1200],
  ])("keeps the position when switching %s -> %s", (from, to, y) => {
    const { getByText } = mountLang(from, to, "/unused");
    atY(y);
    act(() => {
      getByText("switch").click();
    });
    expect(scrollSpy).toHaveBeenCalledWith(0, y);
    expect(scrollSpy).not.toHaveBeenCalledWith(0, 0);
  });

  it("keeps the position for equivalent nested routes and localized blog slugs", () => {
    for (const [from, to] of [
      ["/servicios", "/en/services"],
      ["/blog/masaje-relajante", "/ru/blog/rasslablyayushchiy-massazh"],
    ]) {
      scrollSpy.mockClear();
      const { getByText, unmount } = mountLang(from, to, "/unused");
      atY(770);
      act(() => {
        getByText("switch").click();
      });
      expect(scrollSpy).toHaveBeenCalledWith(0, 770);
      unmount();
    }
  });

  it("still sends a plain PUSH without the flag to the top", () => {
    const { getByText } = mountLang("/", "/en", "/unused");
    atY(500);
    act(() => {
      getByText("plain").click();
    });
    expect(scrollSpy).toHaveBeenCalledWith(0, 0);
  });

  it("uses the saved position on Back/Forward, not the language-switch state", () => {
    const { getByText } = mountLang("/", "/en", "/unused");
    atY(900);
    act(() => {
      getByText("switch").click();
    });
    // The page "/" is later remembered at a different offset.
    sessionStorage.setItem(scrollKey("/", ""), "410");
    scrollSpy.mockClear();
    act(() => {
      getByText("back").click();
    });
    expect(scrollSpy).toHaveBeenCalledWith(0, 410);
  });

  it("never uses a smooth technical scroll", () => {
    const { getByText } = mountLang("/", "/en", "/unused");
    atY(300);
    act(() => {
      getByText("switch").click();
    });
    expect(scrollSpy.mock.calls.every((c) => typeof c[0] === "number" && typeof c[1] === "number")).toBe(true);
  });
});
