import { describe, it, expect } from "vitest";
import { normalizePhoneForWhatsApp, leadWhatsAppUrl, isWhatsAppReachable } from "@/lib/phone";

describe("normalizePhoneForWhatsApp", () => {
  it("keeps international + numbers as digits", () => {
    expect(normalizePhoneForWhatsApp("+34 600 11 22 33")).toBe("34600112233");
    expect(normalizePhoneForWhatsApp("+7 916 123-45-67")).toBe("79161234567");
  });

  it("strips the 00 international prefix", () => {
    expect(normalizePhoneForWhatsApp("0034600112233")).toBe("34600112233");
    expect(normalizePhoneForWhatsApp("00 44 7700 900123")).toBe("447700900123");
  });

  it("prefixes 34 for 9-digit Spanish local numbers", () => {
    expect(normalizePhoneForWhatsApp("600112233")).toBe("34600112233");
    expect(normalizePhoneForWhatsApp("960 11 22 33")).toBe("34960112233");
  });

  it("handles formatted numbers with punctuation", () => {
    expect(normalizePhoneForWhatsApp("(+34) 600-11.22 33")).toBe("34600112233");
  });

  it("returns null for empty values", () => {
    expect(normalizePhoneForWhatsApp("")).toBeNull();
    expect(normalizePhoneForWhatsApp("   ")).toBeNull();
    expect(normalizePhoneForWhatsApp(null)).toBeNull();
    expect(normalizePhoneForWhatsApp(undefined)).toBeNull();
  });

  it("returns null for clearly invalid numbers", () => {
    expect(normalizePhoneForWhatsApp("12345")).toBeNull();
    expect(normalizePhoneForWhatsApp("no tengo")).toBeNull();
    expect(normalizePhoneForWhatsApp("0123456789")).toBeNull();
    expect(normalizePhoneForWhatsApp("+1234567890123456789")).toBeNull();
  });
});

describe("leadWhatsAppUrl", () => {
  it("builds a wa.me link from the lead phone only", () => {
    expect(leadWhatsAppUrl("+34 600 11 22 33", "Hola Ana")).toBe(
      "https://wa.me/34600112233?text=Hola%20Ana",
    );
  });

  it("never falls back to a business number", () => {
    expect(leadWhatsAppUrl("", "Hola")).toBeNull();
    expect(leadWhatsAppUrl("abc", "Hola")).toBeNull();
  });

  it("exposes a reachability helper", () => {
    expect(isWhatsAppReachable("600112233")).toBe(true);
    expect(isWhatsAppReachable("x")).toBe(false);
  });
});
