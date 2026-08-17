import { describe, it, expect } from "vitest";
import { storageThumbUrl } from "@/lib/gallery";

const ORIGIN = new URL(import.meta.env.VITE_SUPABASE_URL as string).origin;
const ok = `${ORIGIN}/storage/v1/object/public/media/sala.webp`;

describe("storageThumbUrl origin hardening", () => {
  it("rewrites only objects served by the configured project", () => {
    const url = storageThumbUrl(ok)!;
    expect(url.startsWith(`${ORIGIN}/storage/v1/render/image/public/media/sala.webp`)).toBe(true);
  });

  it("refuses a look-alike foreign origin with the exact same path", () => {
    expect(storageThumbUrl("https://evil.example/storage/v1/object/public/media/x.webp")).toBeNull();
    expect(storageThumbUrl("https://ukjljyrejfkyurebksqz.supabase.co.evil.test/storage/v1/object/public/media/x.webp")).toBeNull();
  });

  it("refuses non-https and other buckets", () => {
    expect(storageThumbUrl(ok.replace("https:", "http:"))).toBeNull();
    expect(storageThumbUrl(`${ORIGIN}/storage/v1/object/public/other/x.webp`)).toBeNull();
  });

  it("returns null (never throws) for malformed percent-encoding", () => {
    expect(() => storageThumbUrl(`${ORIGIN}/storage/v1/object/public/media/%zz.webp`)).not.toThrow();
    expect(storageThumbUrl(`${ORIGIN}/storage/v1/object/public/media/%zz.webp`)).toBeNull();
    expect(storageThumbUrl(`${ORIGIN}/storage/v1/object/public/media/%E0%A4%A.webp`)).toBeNull();
  });

  it("refuses plain and encoded traversal", () => {
    expect(storageThumbUrl(`${ORIGIN}/storage/v1/object/public/media/../secret.webp`)).toBeNull();
    expect(storageThumbUrl(`${ORIGIN}/storage/v1/object/public/media/%2e%2e%2fsecret.webp`)).toBeNull();
    expect(storageThumbUrl(`${ORIGIN}/storage/v1/object/public/media/sub%2Fx.webp`)).toBeNull();
  });

  it("keeps working percent-encoding for legitimate names", () => {
    const url = storageThumbUrl(`${ORIGIN}/storage/v1/object/public/media/sala%20grande.webp`)!;
    expect(url).toContain("/render/image/public/media/sala%20grande.webp");
    expect(url).toContain("width=800");
  });

  it("still refuses non-transformable formats and garbage input", () => {
    expect(storageThumbUrl(`${ORIGIN}/storage/v1/object/public/media/logo.svg`)).toBeNull();
    expect(storageThumbUrl("not a url")).toBeNull();
    expect(storageThumbUrl("")).toBeNull();
  });
});
