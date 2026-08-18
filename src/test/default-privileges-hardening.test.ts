import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "supabase", "migrations");
const DEFAULTS_FILE = "20260818090714_c5b5f065-faec-42af-a7e3-a90d3d3eb8f9.sql";
const DEFAULTS = readFileSync(join(DIR, DEFAULTS_FILE), "utf8");
const ALL_SQL = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .map((f) => readFileSync(join(DIR, f), "utf8"))
  .join("\n");

/**
 * Guards the schema-level default privileges (pg_default_acl) for schema
 * `public`. Without this, every newly created table/sequence/function would
 * again be handed `arwdDxtm` / `rwU` / `X` to anon + authenticated, which
 * re-opens structural privileges (TRUNCATE, TRIGGER, REFERENCES, MAINTAIN)
 * that RLS does not filter.
 */
describe("default privileges hardening migration", () => {
  it("covers both object owners of schema public", () => {
    expect(DEFAULTS).toMatch(/ARRAY\['postgres','supabase_admin'\]/);
    expect(DEFAULTS).toMatch(/ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public/);
  });

  it("revokes automatic table, sequence and function defaults from API roles", () => {
    expect(DEFAULTS).toMatch(/REVOKE ALL ON TABLES FROM anon, authenticated/);
    expect(DEFAULTS).toMatch(/REVOKE ALL ON SEQUENCES FROM anon, authenticated/);
    expect(DEFAULTS).toMatch(/REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated/);
  });

  it("keeps service_role defaults intact", () => {
    expect(DEFAULTS).toMatch(/GRANT ALL ON TABLES TO service_role/);
    expect(DEFAULTS).toMatch(/GRANT ALL ON SEQUENCES TO service_role/);
    expect(DEFAULTS).toMatch(/GRANT EXECUTE ON FUNCTIONS TO service_role/);
  });

  it("is idempotent and skips owners the migration user cannot alter", () => {
    expect(DEFAULTS).toMatch(/pg_has_role\(current_user, owner_role, 'USAGE'\)/);
    expect(DEFAULTS).toMatch(/FROM pg_roles WHERE rolname = owner_role/);
  });

  it("never re-grants blanket defaults back to anon or authenticated", () => {
    const reopens =
      /ALTER DEFAULT PRIVILEGES[\s\S]{0,200}?GRANT\s+(ALL|TRUNCATE|TRIGGER|REFERENCES|MAINTAIN)[\s\S]{0,80}?TO[^;]*\b(anon|authenticated)\b/i;
    expect(ALL_SQL).not.toMatch(reopens);
  });

  it("does not create sequences in public that would need API-role access", () => {
    expect(ALL_SQL).not.toMatch(/CREATE\s+SEQUENCE\s+(public\.|")/i);
    expect(ALL_SQL).not.toMatch(/\b(BIGSERIAL|SERIAL|SMALLSERIAL)\b/i);
    expect(ALL_SQL).not.toMatch(/GENERATED\s+(ALWAYS|BY DEFAULT)\s+AS\s+IDENTITY/i);
  });
});
