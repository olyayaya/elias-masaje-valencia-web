import { describe, it, expect } from "vitest";
import { applyAltToOtherLangs, mergeAltDraft, buildImageAttrs } from "@/components/dashboard/DashboardBlog";

const SRC = "https://cdn.test/back.webp";

describe("blog alt merge", () => {
  it("keeps the new alt in the edited language and translates only matching images", () => {
    const draft = {
      content: `<p><img src="${SRC}" alt="viejo"></p>`,
      content_en: `<p><img src="${SRC}" alt=""></p><p><img src="https://cdn.test/other.webp" alt="Other"></p>`,
      content_ru: `<p><img src="https://cdn.test/other.webp" alt="Другое"></p>`,
    };
    // What the editor would hold after the dialog confirmed the ES alt.
    const editorHtml = `<p><img src="${SRC}" alt="Masaje de espalda"></p>`;
    const patch = applyAltToOtherLangs(draft, "es", SRC, {
      es: "Masaje de espalda",
      en: "Back massage",
      ru: "Массаж спины",
    }, false);

    const final = mergeAltDraft(draft, "content", editorHtml, patch);

    expect(final.content).toContain('alt="Masaje de espalda"');
    expect(final.content_en).toContain('alt="Back massage"');
    // The other image in EN is untouched, and RU has no matching image at all.
    expect(final.content_en).toContain('alt="Other"');
    expect(final.content_ru).toBe(draft.content_ru);
  });

  it("marks a decorative image with an empty alt", () => {
    expect(buildImageAttrs(SRC, "ignored", true).alt).toBe("");
  });
});
