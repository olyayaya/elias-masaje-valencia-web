import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "supabase", "migrations");
const FILE = "20260818071421_b60bf08d-718e-44af-ba46-9e30418570c0.sql";
const SQL = readFileSync(join(DIR, FILE), "utf8");

const SECURITY_DEFINER_FUNCTIONS = [
  "public.review_is_public",
  "public.has_role",
  "public.count_media_history_refs",
  "public.log_content_change",
  "public.handle_new_user_bootstrap_admin",
  "public.swap_gallery_order",
  "public.rewrite_media_references",
];

/** Bodies of every CREATE OR REPLACE FUNCTION block in the migration, keyed by name. */
const bodies = new Map<string, string>();
for (const match of SQL.matchAll(/CREATE OR REPLACE FUNCTION (public\.\w+)\([\s\S]*?\$function\$;/g)) {
  bodies.set(match[1], match[0]);
}

describe("security definer hardening migration", () => {
  it("is applied exactly once (no duplicated manual copy)", () => {
    const copies = readdirSync(DIR).filter((f) => f.includes("b60bf08d-718e-44af-ba46-9e30418570c0"));
    expect(copies).toEqual([FILE]);
  });

  it("pins an empty, immutable search_path on every redefined function", () => {
    for (const [name, body] of bodies) {
      expect(body, name).toMatch(/SET search_path = ''/);
      expect(body, name).not.toMatch(/SET search_path = public/);
    }
    for (const fn of SECURITY_DEFINER_FUNCTIONS) expect(bodies.has(fn), fn).toBe(true);
  });

  it("fully schema-qualifies table access so an empty search_path resolves", () => {
    for (const [name, body] of bodies) {
      const tables = ["user_roles", "content_history", "gallery_items", "media_aliases", "review_display_settings"];
      for (const t of tables) {
        for (const m of body.matchAll(new RegExp(`(\\w*\\.?)${t}\\b`, "g"))) {
          expect(m[1], `${name} -> ${t}`).toBe("public.");
        }
      }
    }
  });

  it("revokes EXECUTE from PUBLIC/anon on every hardened function", () => {
    for (const fn of SECURITY_DEFINER_FUNCTIONS) {
      const revoke = new RegExp(`REVOKE ALL ON FUNCTION ${fn.replace(".", "\\.")}\\([^)]*\\) FROM PUBLIC, anon`);
      expect(SQL, fn).toMatch(revoke);
    }
  });

  it("keeps direct execute away from anon and authenticated for internal helpers", () => {
    for (const fn of [
      "public.review_is_public",
      "public.count_media_history_refs",
      "public.current_actor",
      "public.update_updated_at_column",
      "public.log_content_change",
      "public.handle_new_user_bootstrap_admin",
      "public.rewrite_media_references",
    ]) {
      const esc = fn.replace(".", "\\.");
      expect(SQL, fn).toMatch(new RegExp(`REVOKE ALL ON FUNCTION ${esc}\\([^)]*\\) FROM PUBLIC, anon, authenticated`));
      expect(SQL, fn).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION ${esc}\\([^)]*\\) TO service_role`));
    }
  });

  it("keeps has_role and swap_gallery_order callable by authenticated (needed by RLS/dashboard)", () => {
    expect(SQL).toMatch(/GRANT EXECUTE ON FUNCTION public\.has_role\(uuid, public\.app_role\) TO authenticated, service_role/);
    expect(SQL).toMatch(/GRANT EXECUTE ON FUNCTION public\.swap_gallery_order\(uuid, uuid\) TO authenticated, service_role/);
  });

  it("stops signed-in users from probing another user's role", () => {
    const body = bodies.get("public.has_role")!;
    expect(body).toMatch(/jwt_role NOT IN \('service_role', ''\)/);
    expect(body).toMatch(/_user_id <> auth\.uid\(\)[\s\S]*RETURN false/);
  });

  it("guards every mutating routine", () => {
    const swap = bodies.get("public.swap_gallery_order")!;
    expect(swap).toMatch(/jwt_role = 'service_role'/);
    expect(swap).toMatch(/public\.has_role\(auth\.uid\(\), 'admin'::public\.app_role\)/);
    expect(swap).toMatch(/RAISE EXCEPTION 'not authorized'/);

    const rewrite = bodies.get("public.rewrite_media_references")!;
    expect(rewrite).toMatch(/jwt_role NOT IN \('service_role', ''\)[\s\S]*RAISE EXCEPTION 'not authorized'/);
    expect(rewrite).toMatch(/_actor IS NULL OR NOT EXISTS \([\s\S]*public\.user_roles[\s\S]*'admin'::public\.app_role[\s\S]*RAISE EXCEPTION 'actor must be an admin'/);
  });

  it("keeps public review visibility working without exposing the helper function", () => {
    expect(SQL).toMatch(/CREATE POLICY "Public reviews are readable"[\s\S]*TO anon, authenticated/);
    expect(SQL).toMatch(/FROM public\.review_display_settings s/);
    expect(SQL).not.toMatch(/USING \(\s*public\.review_is_public/);
  });

  it("does not touch any row data outside of function bodies", () => {
    const withoutBodies = SQL.replace(/\$function\$[\s\S]*?\$function\$/g, "");
    expect(withoutBodies).not.toMatch(/\b(INSERT INTO|UPDATE|DELETE FROM|TRUNCATE)\b/);
    expect(SQL).not.toMatch(/\bDROP FUNCTION\b/);
  });
});
