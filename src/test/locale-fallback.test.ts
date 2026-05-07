import { describe, it, expect } from "vitest";
import { resolveField } from "@/hooks/use-db-content";

/**
 * QA: Empty EN/RU values must always fall back to ES across consumers
 * (Home + Services both call resolveField for title/description/duration/price).
 */
describe("resolveField — locale fallback", () => {
  const record = {
    title: "Masaje relajante",
    title_en: "Relaxing massage",
    title_ru: "",
    description: "Descripción ES",
    description_en: "",
    description_ru: "Описание RU",
    duration: "60 min",
    duration_en: "",
    duration_ru: "",
    price: "50 €",
    price_en: "€50",
    price_ru: "",
  };

  it("returns ES base for lang=es", () => {
    expect(resolveField(record, "title", "es")).toBe("Masaje relajante");
    expect(resolveField(record, "duration", "es")).toBe("60 min");
  });

  it("returns translated value when present", () => {
    expect(resolveField(record, "title", "en")).toBe("Relaxing massage");
    expect(resolveField(record, "description", "ru")).toBe("Описание RU");
    expect(resolveField(record, "price", "en")).toBe("€50");
  });

  it("falls back to ES when EN value is empty", () => {
    expect(resolveField(record, "description", "en")).toBe("Descripción ES");
    expect(resolveField(record, "duration", "en")).toBe("60 min");
  });

  it("falls back to ES when RU value is empty", () => {
    expect(resolveField(record, "title", "ru")).toBe("Masaje relajante");
    expect(resolveField(record, "duration", "ru")).toBe("60 min");
    expect(resolveField(record, "price", "ru")).toBe("50 €");
  });

  it("falls back to ES when translated value is whitespace only", () => {
    const r = { title: "Hola", title_en: "   ", title_ru: "\n\t" };
    expect(resolveField(r, "title", "en")).toBe("Hola");
    expect(resolveField(r, "title", "ru")).toBe("Hola");
  });

  it("returns empty string when both base and translation are missing", () => {
    expect(resolveField({}, "title", "en")).toBe("");
    expect(resolveField({}, "title", "es")).toBe("");
  });

  it("applies the same fallback rules across Home & Services field set", () => {
    const fields = ["title", "description", "duration", "price"] as const;
    for (const f of fields) {
      // EN fallback parity
      const en = resolveField(record, f, "en");
      expect(en.length).toBeGreaterThan(0);
      // RU fallback parity
      const ru = resolveField(record, f, "ru");
      expect(ru.length).toBeGreaterThan(0);
    }
  });
});
