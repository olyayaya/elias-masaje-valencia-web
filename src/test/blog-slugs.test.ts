import { describe, it, expect } from "vitest";
import {
  localizedSlug,
  localizedPostUrl,
  localizedPostAlternates,
  slugField,
  slugify,
  isValidSlug,
} from "@/lib/blog-slugs";
import { getEquivalentPath, BASE_URL } from "@/config/routes";

const RUNNERS = {
  id: "id-1",
  slug: "sportivnyy-massazh-dlya-begunov-valensiya",
  slug_es: "beneficios-masaje-deportivo-corredores-valencia",
  slug_en: "sports-massage-benefits-runners-active-men-valencia",
  slug_ru: "sportivnyy-massazh-dlya-begunov-valensiya",
};

describe("localized blog slugs", () => {
  it("maps each locale to its own column", () => {
    expect(slugField("es")).toBe("slug_es");
    expect(slugField("en")).toBe("slug_en");
    expect(slugField("ru")).toBe("slug_ru");
  });

  it("resolves the localized slug per locale", () => {
    expect(localizedSlug(RUNNERS, "es")).toBe("beneficios-masaje-deportivo-corredores-valencia");
    expect(localizedSlug(RUNNERS, "en")).toBe("sports-massage-benefits-runners-active-men-valencia");
    expect(localizedSlug(RUNNERS, "ru")).toBe("sportivnyy-massazh-dlya-begunov-valensiya");
  });

  it("falls back to the legacy slug, then the id, when localized columns are null", () => {
    const partial = { id: "id-2", slug: "legacy-slug", slug_es: null, slug_en: "", slug_ru: null };
    expect(localizedSlug(partial, "es")).toBe("legacy-slug");
    expect(localizedSlug(partial, "en")).toBe("legacy-slug");
    expect(localizedSlug(partial, "ru")).toBe("legacy-slug");
    expect(localizedSlug({ id: "id-3", slug: null }, "en")).toBe("id-3");
  });

  it("builds localized absolute URLs", () => {
    expect(localizedPostUrl(RUNNERS, "en")).toBe(
      `${BASE_URL}/en/blog/sports-massage-benefits-runners-active-men-valencia`,
    );
    expect(localizedPostUrl(RUNNERS, "ru")).toBe(
      `${BASE_URL}/ru/blog/sportivnyy-massazh-dlya-begunov-valensiya`,
    );
  });

  it("emits reciprocal hreflang with Spanish x-default", () => {
    const alts = localizedPostAlternates(RUNNERS);
    expect(alts.map((a) => a.hreflang)).toEqual(["es", "en", "ru", "x-default"]);
    expect(alts.find((a) => a.hreflang === "x-default")!.href).toBe(
      `${BASE_URL}/blog/beneficios-masaje-deportivo-corredores-valencia`,
    );
  });

  it("language switching uses the target locale slug, not the current one", () => {
    const current = "/blog/beneficios-masaje-deportivo-corredores-valencia";
    expect(getEquivalentPath(current, "en", localizedSlug(RUNNERS, "en"))).toBe(
      "/en/blog/sports-massage-benefits-runners-active-men-valencia",
    );
    expect(getEquivalentPath(current, "ru", localizedSlug(RUNNERS, "ru"))).toBe(
      "/ru/blog/sportivnyy-massazh-dlya-begunov-valensiya",
    );
    // Without a resolved post the current slug is reused (backward compatible).
    expect(getEquivalentPath(current, "en")).toBe(
      "/en/blog/beneficios-masaje-deportivo-corredores-valencia",
    );
  });

  it("slugify produces lowercase ASCII hyphen slugs", () => {
    expect(slugify("Beneficios del Masaje Deportivo — Corredores")).toBe(
      "beneficios-del-masaje-deportivo-corredores",
    );
    expect(isValidSlug("5-benefits-back-massage-office-workers")).toBe(true);
    expect(isValidSlug("Bad_Slug")).toBe(false);
    expect(isValidSlug("-leading")).toBe(false);
  });
});
