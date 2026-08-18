import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../supabase/migrations");
const BASE_FILE = "20260818063851_f3c96eb0-7f8a-4fdb-b4db-7f71fdf5ad18.sql";

function cropMigrationFiles(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .filter((f) =>
      fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8").includes("thumbnail_zoom"),
    )
    .sort();
}

const read = (f: string) => fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8");

describe("gallery thumbnail crop migration", () => {
  it("declares 50/50/1 defaults and three CHECK range constraints", () => {
    const sql = read(BASE_FILE);

    expect(sql).toMatch(/thumbnail_x numeric NOT NULL DEFAULT 50/i);
    expect(sql).toMatch(/thumbnail_y numeric NOT NULL DEFAULT 50/i);
    expect(sql).toMatch(/thumbnail_zoom numeric NOT NULL DEFAULT 1/i);

    expect(sql).toMatch(/gallery_items_thumbnail_x_range CHECK \(thumbnail_x >= 0 AND thumbnail_x <= 100\)/i);
    expect(sql).toMatch(/gallery_items_thumbnail_y_range CHECK \(thumbnail_y >= 0 AND thumbnail_y <= 100\)/i);

    expect((sql.match(/CHECK \(/gi) ?? []).length).toBe(3);
  });

  it("relaxes the zoom range to 0.5–3 so thumbnails can be zoomed out", () => {
    const latest = cropMigrationFiles().at(-1) as string;
    expect(latest).not.toBe(BASE_FILE);
    const sql = read(latest);
    expect(sql).toMatch(
      /gallery_items_thumbnail_zoom_range CHECK \(thumbnail_zoom >= 0\.5 AND thumbnail_zoom <= 3\)/i,
    );
  });
});
