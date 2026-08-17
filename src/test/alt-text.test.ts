import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { generateHTML } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import ImageExt from "@tiptap/extension-image";
import {
  altColumn,
  altStatus,
  countMissingAlt,
  countNonLocalizedAlt,
  DECORATIVE_ATTR,
  MAX_ALT_LENGTH,
  pickAlt,
  validateAlt,
} from "@/lib/alt-text";
import { SCANS } from "../../supabase/functions/media-guard/rules";

const row = {
  alt_text: "Masaje de espalda",
  alt_text_en: "Back massage",
  alt_text_ru: null,
};

describe("localized carousel alt", () => {
  it("selects the alt of the active locale", () => {
    expect(pickAlt(row, "es")).toBe("Masaje de espalda");
    expect(pickAlt(row, "en")).toBe("Back massage");
  });

  it("falls back to the Spanish alt, then to an empty string", () => {
    expect(pickAlt(row, "ru")).toBe("Masaje de espalda");
    expect(pickAlt({ alt_text: "", alt_text_en: null, alt_text_ru: null }, "en")).toBe("");
  });

  it("maps each language to its own column so saves stay independent", () => {
    expect(altColumn("es")).toBe("alt_text");
    expect(altColumn("en")).toBe("alt_text_en");
    expect(altColumn("ru")).toBe("alt_text_ru");
    expect(altStatus(row)).toEqual({ es: true, en: true, ru: false });
  });
});

describe("alt validation", () => {
  it("requires text for informative images and allows empty for decorative ones", () => {
    expect(validateAlt("", false)).toBe("empty");
    expect(validateAlt("   ", false)).toBe("empty");
    expect(validateAlt("", true)).toBeNull();
    expect(validateAlt("Back massage in the Valencia studio", false)).toBeNull();
  });

  it("rejects an over-long alt", () => {
    expect(validateAlt("x".repeat(MAX_ALT_LENGTH + 1), false)).toBe("tooLong");
  });
});

describe("alt auditing in article HTML", () => {
  const html =
    '<p><img src="a.webp" alt="Masaje"></p>' +
    '<p><img src="b.webp" alt=""></p>' +
    `<p><img src="c.webp" alt="" ${DECORATIVE_ATTR}="true"></p>`;

  it("counts only informative images without alt", () => {
    expect(countMissingAlt(html)).toBe(1);
  });

  it("flags alt text carried over from the source language", () => {
    const es = '<p><img src="a.webp" alt="Masaje de espalda"></p><p><img src="b.webp" alt="Camilla"></p>';
    const en = '<p><img src="a.webp" alt="Masaje de espalda"></p><p><img src="b.webp" alt="Massage table"></p>';
    expect(countNonLocalizedAlt(es, en)).toBe(1);
  });
});

describe("editor serialization", () => {
  const ImageWithAlt = ImageExt.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        [DECORATIVE_ATTR]: {
          default: null,
          parseHTML: (el: HTMLElement) => el.getAttribute(DECORATIVE_ATTR),
          renderHTML: (attrs: Record<string, unknown>) =>
            attrs[DECORATIVE_ATTR] ? { [DECORATIVE_ATTR]: "true" } : {},
        },
      };
    },
  });
  const exts = [StarterKit, ImageWithAlt];

  it("keeps the alt attribute of an inserted image", () => {
    const doc = {
      type: "doc",
      content: [{ type: "image", attrs: { src: "https://cdn.test/a.webp", alt: "Back massage" } }],
    };
    expect(generateHTML(doc, exts)).toContain('alt="Back massage"');
  });

  it("serializes a decorative image as alt=\"\" with an explicit marker", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "image", attrs: { src: "https://cdn.test/a.webp", alt: "", [DECORATIVE_ATTR]: "true" } },
      ],
    };
    const html = generateHTML(doc, exts);
    expect(html).toContain('alt=""');
    expect(html).toContain(`${DECORATIVE_ATTR}="true"`);
    expect(countMissingAlt(html)).toBe(0);
  });
});

describe("media safety covers the new columns", () => {
  it("scans the localized alt columns for media usage", () => {
    const pageImages = SCANS.find((s) => s.table === "page_images")!;
    expect(pageImages.fields).toEqual(
      expect.arrayContaining(["image_url", "alt_text", "alt_text_en", "alt_text_ru"]),
    );
  });

  it("rewrites references in the localized alt columns transactionally", () => {
    const sql = readFileSync("supabase/migrations/20260817074200_30c4faf7-025f-48dd-8ca8-0c308a383155.sql", "utf8");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS alt_text_en");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS alt_text_ru");
    expect(sql).toMatch(/alt_text_en = replace\(replace\(alt_text_en, o, _new\), e, _new_enc\)/);
    expect(sql).toMatch(/alt_text_ru = replace\(replace\(alt_text_ru, o, _new\), e, _new_enc\)/);
    // No regression in the alias mechanism used by rename / history restore.
    expect(sql).toContain("INSERT INTO public.media_aliases");
    expect(sql).toContain("DELETE FROM public.media_aliases WHERE old_name = new_name");
  });
});
