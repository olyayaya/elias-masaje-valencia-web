import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const engagement = readFileSync("supabase/pending-migrations/20260819080000_gallery_engagement.sql", "utf8");
const reorder = readFileSync("supabase/pending-migrations/20260819090000_gallery_reorder.sql", "utf8");

describe("gallery engagement migration", () => {
  it("is additive and idempotent — no destructive statement on existing data", () => {
    expect(engagement).toContain("ADD COLUMN IF NOT EXISTS view_count");
    expect(engagement).toContain("ADD COLUMN IF NOT EXISTS like_count");
    expect(engagement).toContain("DEFAULT 0");
    expect(engagement).not.toMatch(/DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM public\.gallery_items/i);
    expect(engagement).not.toMatch(/UPDATE public\.gallery_items\s+SET (media_url|published|sort_order)/i);
  });

  it("keeps counters non-negative and indexed for sorting", () => {
    expect(engagement).toMatch(/CHECK \(view_count >= 0\)/);
    expect(engagement).toMatch(/CHECK \(like_count >= 0\)/);
    expect(engagement).toContain("gallery_items_view_count_idx");
    expect(engagement).toContain("gallery_items_created_at_idx");
  });

  it("stores one like per visitor per item with a cascading FK", () => {
    expect(engagement).toContain("REFERENCES public.gallery_items(id) ON DELETE CASCADE");
    expect(engagement).toContain("UNIQUE (item_id, visitor_id)");
    expect(engagement).toContain("gallery_likes_item_idx");
    expect(engagement).toContain("created_at timestamptz NOT NULL DEFAULT now()");
  });

  it("blocks direct public writes and only exposes the RPCs", () => {
    expect(engagement).toContain("ENABLE ROW LEVEL SECURITY");
    expect(engagement).toMatch(/REVOKE ALL ON public\.gallery_likes FROM anon, authenticated/);
    expect(engagement).toMatch(/REVOKE INSERT, UPDATE, DELETE ON public\.gallery_items FROM anon/);
    expect(engagement).toContain("GRANT ALL ON public.gallery_likes TO service_role");
  });

  it("hardens both RPCs with a fixed search_path and explicit grants", () => {
    for (const fn of ["increment_gallery_view", "toggle_gallery_like"]) {
      expect(engagement).toContain(`FUNCTION public.${fn}`);
    }
    expect(engagement.match(/SECURITY DEFINER/g)?.length).toBe(2);
    expect(engagement.match(/SET search_path = ''/g)?.length).toBe(2);
    expect(engagement).toMatch(/REVOKE ALL ON FUNCTION public\.increment_gallery_view\(uuid\) FROM PUBLIC/);
    expect(engagement).toMatch(/GRANT EXECUTE ON FUNCTION public\.toggle_gallery_like\(uuid, text, boolean\) TO anon, authenticated, service_role/);
  });

  it("only counts views and likes for published items", () => {
    expect(engagement).toMatch(/WHERE id = _item_id\s+AND published = true/);
    expect(engagement).toContain("gallery item not found or not published");
  });

  it("is marked as pending, not applied", () => {
    expect(engagement).toContain("STATUS: PENDING");
    expect(reorder).toContain("STATUS: PENDING");
  });
});

describe("gallery reorder migration", () => {
  it("is admin-only, hardened and never exposed to anon", () => {
    expect(reorder).toContain("SECURITY DEFINER");
    expect(reorder).toContain("SET search_path = ''");
    expect(reorder).toContain("public.has_role(auth.uid(), 'admin'::public.app_role)");
    expect(reorder).toMatch(/REVOKE ALL ON FUNCTION public\.reorder_gallery_items\(uuid\[\]\) FROM anon/);
    expect(reorder).toMatch(/GRANT EXECUTE ON FUNCTION public\.reorder_gallery_items\(uuid\[\]\) TO authenticated, service_role/);
  });

  it("rejects duplicate or unknown ids instead of scrambling the order", () => {
    expect(reorder).toContain("duplicate gallery item id");
    expect(reorder).toContain("unknown gallery item id");
  });

  it("touches only sort_order and updated_at", () => {
    expect(reorder).not.toMatch(/DROP|DELETE|TRUNCATE|ALTER TABLE/i);
    expect(reorder).toMatch(/SET sort_order = d\.position/);
  });
});
