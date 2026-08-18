import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "supabase", "migrations");
const GRANTS_FILE = "20260818085843_dadd6a77-4495-46d3-8430-bfbe78ce671e.sql";
const AUDIT_FILE = "20260818085912_87b101ee-b63b-43ba-9384-946c4252351c.sql";
const GRANTS = readFileSync(join(DIR, GRANTS_FILE), "utf8");
const AUDIT = readFileSync(join(DIR, AUDIT_FILE), "utf8");
const ALL_SQL = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .map((f) => readFileSync(join(DIR, f), "utf8"))
  .join("\n");

/**
 * Predicates mirroring the production RLS `USING` clauses for the public
 * (anon + authenticated non-admin) read policies. Keep in sync with the DB.
 */
const servicePublic = (r: { hidden: boolean }) => r.hidden === false;
const testimonialPublic = (r: { hidden: boolean }) => r.hidden === false;
const promotionPublic = (
  r: { active: boolean; starts_at: Date | null; ends_at: Date | null },
  now: Date,
) =>
  r.active === true &&
  (r.starts_at === null || r.starts_at.getTime() <= now.getTime()) &&
  (r.ends_at === null || r.ends_at.getTime() >= now.getTime());

const NOW = new Date("2026-08-18T09:00:00Z");
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

describe("public read policy matrix (anon / authenticated non-admin)", () => {
  it("hides hidden services and testimonials, shows visible ones", () => {
    expect(servicePublic({ hidden: false })).toBe(true);
    expect(servicePublic({ hidden: true })).toBe(false);
    expect(testimonialPublic({ hidden: false })).toBe(true);
    expect(testimonialPublic({ hidden: true })).toBe(false);
  });

  it("exposes only active, in-window promotions", () => {
    const cases: Array<[string, Parameters<typeof promotionPublic>[0], boolean]> = [
      ["active current", { active: true, starts_at: day(-1), ends_at: day(1) }, true],
      ["inactive current", { active: false, starts_at: day(-1), ends_at: day(1) }, false],
      ["active future", { active: true, starts_at: day(1), ends_at: day(2) }, false],
      ["active expired", { active: true, starts_at: day(-5), ends_at: day(-1) }, false],
      ["null bounds", { active: true, starts_at: null, ends_at: null }, true],
      ["null start, future end", { active: true, starts_at: null, ends_at: day(1) }, true],
      ["past start, null end", { active: true, starts_at: day(-1), ends_at: null }, true],
      ["inactive with null bounds", { active: false, starts_at: null, ends_at: null }, false],
    ];
    for (const [label, row, expected] of cases) {
      expect(promotionPublic(row, NOW), label).toBe(expected);
    }
  });

  it("treats the window as inclusive on both boundaries", () => {
    expect(promotionPublic({ active: true, starts_at: NOW, ends_at: day(1) }, NOW)).toBe(true);
    expect(promotionPublic({ active: true, starts_at: day(-1), ends_at: NOW }, NOW)).toBe(true);
  });
});

describe("grant hardening migration", () => {
  it("is applied exactly once each", () => {
    expect(readdirSync(DIR).filter((f) => f.includes("dadd6a77-4495-46d3-8430-bfbe78ce671e"))).toEqual([GRANTS_FILE]);
    expect(readdirSync(DIR).filter((f) => f.includes("87b101ee-b63b-43ba-9384-946c4252351c"))).toEqual([AUDIT_FILE]);
  });

  it("strips RLS-bypassing privileges (TRUNCATE/TRIGGER/REFERENCES) from the API roles", () => {
    expect(GRANTS).toMatch(/REVOKE TRUNCATE, TRIGGER, REFERENCES, MAINTAIN ON public\.%I FROM anon, authenticated/);
    expect(GRANTS).not.toMatch(/GRANT (ALL|TRUNCATE|TRIGGER|REFERENCES)[^;]*TO (anon|authenticated)/);
  });

  it("leaves anon with read-only access on public content tables", () => {
    for (const t of ["services", "testimonials", "promotions", "faqs", "page_images", "site_content", "gallery_items", "blog_posts"]) {
      expect(GRANTS, t).toMatch(new RegExp(`REVOKE INSERT, UPDATE, DELETE ON public\\.${t} FROM anon`));
    }
    expect(GRANTS).toMatch(/GRANT SELECT ON public\.services[\s\S]*TO anon/);
  });

  it("removes anon access entirely from admin-only tables", () => {
    for (const t of ["user_roles", "content_history", "media_aliases"]) {
      expect(GRANTS, t).toMatch(new RegExp(`REVOKE ALL ON public\\.${t} FROM anon`));
    }
    expect(GRANTS).toMatch(/REVOKE SELECT, UPDATE, DELETE ON public\.booking_leads FROM anon/);
    expect(GRANTS).toMatch(/REVOKE SELECT, UPDATE, DELETE ON public\.conversion_events FROM anon/);
  });

  it("keeps the write paths the public site needs", () => {
    expect(GRANTS).toMatch(/GRANT INSERT ON public\.booking_leads TO anon/);
    expect(GRANTS).toMatch(/GRANT INSERT ON public\.conversion_events TO anon/);
  });

  it("keeps admin dashboard writes possible for signed-in users (RLS gates them)", () => {
    for (const t of ["services", "testimonials", "promotions", "gallery_items", "blog_posts", "reviews"]) {
      expect(GRANTS, t).toMatch(new RegExp(`GRANT SELECT, INSERT, UPDATE, DELETE ON public\\.${t} TO authenticated`));
    }
  });

  it("makes the audit log append-only for signed-in users", () => {
    expect(AUDIT).toMatch(/REVOKE INSERT, UPDATE, DELETE ON public\.content_history FROM authenticated/);
    expect(AUDIT).toMatch(/REVOKE INSERT, UPDATE, DELETE ON public\.media_aliases FROM authenticated/);
  });

  it("never disables row level security anywhere in the migration history", () => {
    expect(ALL_SQL).not.toMatch(/DISABLE ROW LEVEL SECURITY/i);
  });

  it("does not touch row data", () => {
    for (const sql of [GRANTS, AUDIT]) {
      expect(sql.replace(/\$\$[\s\S]*?\$\$/g, "")).not.toMatch(/\b(INSERT INTO|UPDATE \w|DELETE FROM|TRUNCATE TABLE|DROP TABLE)\b/);
    }
  });
});
