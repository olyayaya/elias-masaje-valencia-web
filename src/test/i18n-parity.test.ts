import { describe, it, expect } from "vitest";
import { es } from "@/i18n/es";
import { en } from "@/i18n/en";
import { ru } from "@/i18n/ru";

/**
 * Locale shape parity. TypeScript already enforces the static structure
 * via the `Translations` interface, but list lengths (`items` arrays)
 * are not constrained at the type level — so a locale can silently end
 * up with three benefits while another has four.
 */
describe("locale array parity", () => {
  const locales = { es, en, ru };

  it("benefits.items length matches across locales", () => {
    expect(en.benefits.items.length).toBe(es.benefits.items.length);
    expect(ru.benefits.items.length).toBe(es.benefits.items.length);
  });

  // Services, FAQ and testimonials now come from the database, so there are
  // no static `items` arrays left to compare.



  it("about.paragraphs length matches across locales", () => {
    expect(en.about.paragraphs.length).toBe(es.about.paragraphs.length);
    expect(ru.about.paragraphs.length).toBe(es.about.paragraphs.length);
  });

  it("no locale has empty string values at the top level fields", () => {
    for (const [name, t] of Object.entries(locales)) {
      expect(t.nav.home, `${name}.nav.home`).not.toBe("");
      expect(t.hero.headline, `${name}.hero.headline`).not.toBe("");
      expect(t.services.title, `${name}.services.title`).not.toBe("");
      expect(t.contact.title, `${name}.contact.title`).not.toBe("");
    }
  });
});
