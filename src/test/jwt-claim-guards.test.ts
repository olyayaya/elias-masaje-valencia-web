import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "supabase", "migrations");
const FILE = "20260818072523_a192fcc9-5b0d-492a-b560-ef25b51d2f13.sql";
const SQL = readFileSync(join(DIR, FILE), "utf8");

const bodyOf = (name: string) => {
  const m = SQL.match(new RegExp(`CREATE OR REPLACE FUNCTION ${name}\\([\\s\\S]*?\\$function\\$;`));
  if (!m) throw new Error(`function ${name} not redefined in ${FILE}`);
  return m[0];
};

describe("jwt claim guards migration", () => {
  it("is a single new migration and leaves 20260818071421 untouched", () => {
    const files = readdirSync(DIR);
    expect(files.filter((f) => f.includes("a192fcc9-5b0d-492a-b560-ef25b51d2f13"))).toEqual([FILE]);
    const previous = readFileSync(join(DIR, "20260818071421_b60bf08d-718e-44af-ba46-9e30418570c0.sql"), "utf8");
    // The old, weaker guard still exists only in the already-applied migration file.
    expect(previous).toMatch(/NOT IN \('service_role', ''\)/);
    expect(SQL).not.toMatch(/NOT IN \('service_role', ''\)/);
  });

  it("reads the role claim in a malformed-safe way", () => {
    const body = bodyOf("public\\.jwt_role_claim");
    expect(body).toMatch(/SET search_path = ''/);
    expect(body).toMatch(/EXCEPTION WHEN others THEN\s*\n\s*RETURN '';/);
    expect(body).toMatch(/IF raw IS NULL THEN\s*\n\s*RETURN '';/);
  });

  describe("has_role", () => {
    const body = bodyOf("public\\.has_role");

    it("allows an arbitrary _user_id only for an explicit service_role claim", () => {
      expect(body).toMatch(/IF jwt_role = 'service_role' THEN/);
      // no other branch reaches the lookup with a foreign uuid
      expect(body).toMatch(/ELSIF jwt_role = 'authenticated' THEN[\s\S]*auth\.uid\(\) IS NULL OR _user_id <> auth\.uid\(\)[\s\S]*RETURN false;/);
    });

    it("returns false for empty, malformed, anon or any other claim", () => {
      expect(body).toMatch(/ELSE\s*\n\s*--[^\n]*\n\s*RETURN false;\s*\n\s*END IF;/);
      expect(body).not.toMatch(/jwt_role = ''/);
      expect(body).not.toMatch(/'anon'/);
    });

    it("keeps search_path, schema qualification and ACLs", () => {
      expect(body).toMatch(/SET search_path = ''/);
      expect(body).toMatch(/FROM public\.user_roles/);
      expect(SQL).toMatch(/REVOKE ALL ON FUNCTION public\.has_role\(uuid, public\.app_role\) FROM PUBLIC, anon;/);
      expect(SQL).toMatch(/GRANT EXECUTE ON FUNCTION public\.has_role\(uuid, public\.app_role\) TO authenticated, service_role;/);
    });
  });

  describe("rewrite_media_references", () => {
    const body = bodyOf("public\\.rewrite_media_references");

    it("rejects every non service_role claim before any DML", () => {
      expect(body).toMatch(/IF jwt_role IS DISTINCT FROM 'service_role' THEN\s*\n\s*RAISE EXCEPTION 'not authorized';/);
      const guardIndex = body.indexOf("IS DISTINCT FROM 'service_role'");
      const firstDml = body.search(/\b(UPDATE|INSERT INTO|DELETE FROM) public\./);
      expect(guardIndex).toBeGreaterThan(-1);
      expect(guardIndex).toBeLessThan(firstDml);
    });

    it("still requires an existing admin _actor, also before any DML", () => {
      expect(body).toMatch(/_actor IS NULL OR NOT EXISTS \([\s\S]*public\.user_roles[\s\S]*'admin'::public\.app_role[\s\S]*RAISE EXCEPTION 'actor must be an admin';/);
      const actorGuard = body.indexOf("actor must be an admin");
      const firstDml = body.search(/\b(UPDATE|INSERT INTO|DELETE FROM) public\./);
      expect(actorGuard).toBeLessThan(firstDml);
    });

    it("stays service_role-only", () => {
      expect(SQL).toMatch(/REVOKE ALL ON FUNCTION public\.rewrite_media_references\(text, text, text, text, uuid\) FROM PUBLIC, anon, authenticated;/);
      expect(SQL).toMatch(/GRANT EXECUTE ON FUNCTION public\.rewrite_media_references\(text, text, text, text, uuid\) TO service_role;/);
    });
  });

  it("changes no row data outside function bodies", () => {
    const withoutBodies = SQL.replace(/\$function\$[\s\S]*?\$function\$/g, "");
    expect(withoutBodies).not.toMatch(/\b(INSERT INTO|UPDATE|DELETE FROM|TRUNCATE|DROP)\b/);
  });
});
