import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { planAltTranslations, planToTriple, AltTranslateError } from "@/lib/alt-translate";
import { setAltForSrc, parseImages } from "@/lib/alt-text";
import { otherLangAlts, applyAltToOtherLangs } from "@/components/dashboard/DashboardBlog";

const invokeMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invokeMock(...a) } },
}));

const empty = { es: "", en: "", ru: "" };

describe("alt translation plan", () => {
  it("ES source fills EN and RU", () => {
    const plan = planAltTranslations({
      current: { ...empty, es: "Masaje de espalda" },
      source: "es",
      sourceValue: "Masaje de espalda",
      translations: { en: "Back massage", ru: "Массаж спины" },
    });
    expect(planToTriple(plan)).toEqual({ es: "Masaje de espalda", en: "Back massage", ru: "Массаж спины" });
    expect(plan.filter((r) => r.auto).map((r) => r.lang)).toEqual(["en", "ru"]);
  });

  it("EN source fills ES and RU", () => {
    const plan = planAltTranslations({
      current: empty,
      source: "en",
      sourceValue: "Back massage",
      translations: { es: "Masaje de espalda", ru: "Массаж спины" },
    });
    expect(planToTriple(plan)).toEqual({ es: "Masaje de espalda", en: "Back massage", ru: "Массаж спины" });
  });

  it("RU source fills ES and EN", () => {
    const plan = planAltTranslations({
      current: empty,
      source: "ru",
      sourceValue: "Массаж спины",
      translations: { es: "Masaje de espalda", en: "Back massage" },
    });
    expect(planToTriple(plan)).toEqual({ es: "Masaje de espalda", en: "Back massage", ru: "Массаж спины" });
  });

  it("never silently overwrites a manually written target", () => {
    const plan = planAltTranslations({
      current: { es: "Masaje", en: "Hand written", ru: "" },
      source: "es",
      sourceValue: "Masaje",
      translations: { en: "Machine", ru: "Машина" },
    });
    const en = plan.find((r) => r.lang === "en")!;
    expect(en.value).toBe("Hand written");
    expect(en.conflict).toBe(true);
    expect(en.auto).toBe(false);
    expect(planToTriple(plan).ru).toBe("Машина");
  });

  it("overwrites only when explicitly confirmed", () => {
    const plan = planAltTranslations({
      current: { es: "Masaje", en: "Hand written", ru: "" },
      source: "es",
      sourceValue: "Masaje",
      translations: { en: "Machine" },
      overwrite: { en: true },
    });
    const en = plan.find((r) => r.lang === "en")!;
    expect(en.value).toBe("Machine");
    expect(en.auto).toBe(true);
  });

  it("a failed translation keeps the source and leaves other fields untouched", () => {
    const plan = planAltTranslations({
      current: { es: "", en: "Existing", ru: "" },
      source: "es",
      sourceValue: "Masaje nuevo",
      translations: {},
    });
    expect(planToTriple(plan)).toEqual({ es: "Masaje nuevo", en: "Existing", ru: "" });
    expect(plan.some((r) => r.auto)).toBe(false);
  });
});

describe("translateAlt endpoint client", () => {
  beforeEach(() => invokeMock.mockReset());

  it("returns translations for the requested targets", async () => {
    const { translateAlt } = await import("@/lib/alt-translate");
    invokeMock.mockResolvedValue({ data: { translations: { en: "Back massage", ru: "Массаж спины" } }, error: null });
    await expect(translateAlt("Masaje de espalda", "es")).resolves.toEqual({
      en: "Back massage",
      ru: "Массаж спины",
    });
    expect(invokeMock).toHaveBeenCalledWith("ai-content-helper", {
      body: { action: "translate_alt", text: "Masaje de espalda", sourceLang: "es", targets: ["en", "ru"] },
    });
  });

  it("throws when the function errors", async () => {
    const { translateAlt } = await import("@/lib/alt-translate");
    invokeMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(translateAlt("Masaje", "es")).rejects.toBeInstanceOf(AltTranslateError);
  });

  it("throws when the model returns nothing usable", async () => {
    const { translateAlt } = await import("@/lib/alt-translate");
    invokeMock.mockResolvedValue({ data: { translations: {} }, error: null });
    await expect(translateAlt("Masaje", "es")).rejects.toBeInstanceOf(AltTranslateError);
  });
});

describe("blog HTML alt application", () => {
  const es = '<p>Hola</p><img src="https://cdn.test/a.webp" alt="Masaje"><p>fin</p>';
  const en = '<p>Hi</p><img src="https://cdn.test/a.webp" alt="old"><p>end</p>';
  const ru = "<p>Только текст</p>";

  it("updates only the matching image in versions that already contain it", () => {
    const patch = applyAltToOtherLangs(
      { content: es, content_en: en, content_ru: ru },
      "es",
      "https://cdn.test/a.webp",
      { es: "Masaje", en: "Back massage", ru: "Массаж спины" },
      false,
    );
    expect(Object.keys(patch)).toEqual(["content_en"]);
    expect(parseImages(patch.content_en)[0].alt).toBe("Back massage");
    expect(patch.content_en).toContain("<p>Hi</p>");
    expect(patch.content_en).toContain("<p>end</p>");
  });

  it("never inserts an image into a version that does not have it", () => {
    const patch = applyAltToOtherLangs(
      { content: es, content_ru: ru },
      "es",
      "https://cdn.test/a.webp",
      { es: "Masaje", en: "", ru: "Массаж" },
      false,
    );
    expect(patch.content_ru).toBeUndefined();
  });

  it("does not touch images with another src", () => {
    const html = '<img src="https://cdn.test/b.webp" alt="keep">';
    expect(setAltForSrc(html, "https://cdn.test/a.webp", "new").changed).toBe(false);
    expect(setAltForSrc(html, "https://cdn.test/a.webp", "new").html).toBe(html);
  });

  it("decorative serializes alt='' plus the marker", () => {
    const out = setAltForSrc('<img src="x.webp" alt="foo">', "x.webp", "ignored", true);
    expect(out.html).toContain('alt=""');
    expect(out.html).toContain('data-decorative="true"');
  });

  it("reads the alt already stored in the other versions", () => {
    expect(otherLangAlts({ content: es, content_en: en, content_ru: ru }, "es", "https://cdn.test/a.webp")).toEqual({
      en: "old",
    });
  });
});

describe("translation endpoint protection", () => {
  const src = readFileSync("supabase/functions/ai-content-helper/index.ts", "utf8");

  it("requires a JWT and the admin role before any AI call", () => {
    expect(src).toContain("const auth = await requireAdmin(req);");
    expect(src.indexOf("requireAdmin(req)")).toBeLessThan(src.indexOf("translate_alt"));
    expect(src).toContain('.eq("role", "admin")');
  });

  it("keeps the API key server-side and limits the input length", () => {
    expect(src).toContain('Deno.env.get("LOVABLE_API_KEY")');
    expect(src).toContain("text.length > 300");
    expect(src).toContain("Maximum ${MAX_ALT} characters");
  });
});
