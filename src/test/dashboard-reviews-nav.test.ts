import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dashboardStrings } from "@/i18n/dashboard";

const source = readFileSync("src/pages/Dashboard.tsx", "utf8");

describe("dashboard section order", () => {
  it("puts Library directly after Gallery in the shared section list", () => {
    const list = source.slice(source.indexOf("const primarySections"), source.indexOf("secondarySections"));
    const ids = [...list.matchAll(/id: "([a-z]+)"/g)].map((m) => m[1]);
    expect(ids.indexOf("media")).toBe(ids.indexOf("gallery") + 1);
  });

  it("renders the reviews dashboard for the reviews section", () => {
    expect(source).toMatch(/case "testimonials": return <DashboardReviews \/>/);
  });
});

describe("reviews naming", () => {
  const labels = Object.entries(dashboardStrings).map(([lang, s]) => [lang, s.sections.testimonials] as const);

  it("uses Reseñas / Reviews / Отзывы", () => {
    expect(Object.fromEntries(labels)).toMatchObject({
      es: "Reseñas",
      en: "Reviews",
      ru: "Отзывы",
    });
  });

  it("keeps the old wording out of the UI labels", () => {
    for (const [, label] of labels) {
      expect(label.toLowerCase()).not.toMatch(/testimoni/);
    }
  });
});
