import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: (...a: unknown[]) => toastSuccess(...a) },
}));

const CDN = "https://cdn.test/storage/v1/object/public/media";

type Alias = { old_name: string; new_name: string };

/** Alias rows the mocked SELECT returns, mutable so a test can add one "after mount". */
let aliasRows: Alias[] = [];
let aliasError: { message: string } | null = null;
let aliasFetches = 0;
/** Error the mocked content write returns. */
let writeError: { message: string } | null = null;
const writes: Array<{ table: string; payload: Record<string, unknown>; op: "insert" | "update" }> = [];

const HISTORY_ROWS = [
  {
    id: "h1",
    table_name: "services",
    record_id: "r1",
    action: "update",
    changed_at: "2026-08-17T05:00:00Z",
    snapshot: { id: "r1", title: "Masaje", description: `<img src="${CDN}/a.jpg">` },
  },
  {
    id: "h2",
    table_name: "faqs",
    record_id: "r2",
    action: "update",
    changed_at: "2026-08-17T06:00:00Z",
    snapshot: { id: "r2", question: "Q", answer: `<img src="${CDN}/a.jpg">` },
  },
];

vi.mock("@/integrations/supabase/client", () => {
  const contentBuilder = (table: string) => ({
    insert: async (payload: Record<string, unknown>) => {
      writes.push({ table, payload, op: "insert" });
      return { error: writeError };
    },
    update: (payload: Record<string, unknown>) => ({
      eq: async () => {
        writes.push({ table, payload, op: "update" });
        return { error: writeError };
      },
    }),
  });

  return {
    supabase: {
      from: (table: string) => {
        if (table === "media_aliases") {
          return {
            select: async () => {
              aliasFetches++;
              return aliasError ? { data: null, error: aliasError } : { data: aliasRows, error: null };
            },
          };
        }
        if (table === "content_history") {
          return {
            select: () => ({
              order: () => ({
                limit: async () => ({ data: HISTORY_ROWS, error: null }),
              }),
            }),
            ...contentBuilder(table),
          };
        }
        return contentBuilder(table);
      },
    },
  };
});

import DashboardHistory from "@/components/dashboard/DashboardHistory";

const renderHistory = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DashboardHistory />
    </QueryClientProvider>,
  );
  await screen.findAllByText("Restore");
  return userEvent.setup();
};

beforeEach(() => {
  vi.clearAllMocks();
  aliasRows = [];
  aliasError = null;
  aliasFetches = 0;
  writeError = null;
  writes.length = 0;
});

describe("DashboardHistory restore — alias freshness", () => {
  it("applies an alias created AFTER the component mounted", async () => {
    const user = await renderHistory();
    // Alias appears only now, after mount / after the list was rendered.
    aliasRows = [{ old_name: "a.jpg", new_name: "a.webp" }];

    await user.click(screen.getAllByText("Restore")[0]);

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(JSON.stringify(writes[0].payload)).toContain("a.webp");
    expect(JSON.stringify(writes[0].payload)).not.toContain("a.jpg");
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("blocks the write when the alias fetch fails", async () => {
    const user = await renderHistory();
    aliasError = { message: "network down" };

    await user.click(screen.getAllByText("Restore")[0]);

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(writes).toHaveLength(0);
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(String(toastError.mock.calls[0][0])).toMatch(/alias/i);
  });

  it("reports failure when the database rejects the restore write", async () => {
    const user = await renderHistory();
    writeError = { message: "permission denied" };

    await user.click(screen.getAllByText("Restore")[0]);

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Restore failed"));
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("bulk restore fetches a fresh alias map once and applies it", async () => {
    const user = await renderHistory();
    aliasRows = [{ old_name: "a.jpg", new_name: "a.webp" }];

    const checkboxes = screen.getAllByLabelText("Select for bulk undo");
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.click(screen.getByText(/Undo 2 selected/));
    await user.click(screen.getByText("Undo all selected"));

    await waitFor(() => expect(writes).toHaveLength(2));
    expect(aliasFetches).toBe(1);
    writes.forEach((w) => expect(JSON.stringify(w.payload)).toContain("a.webp"));
  });

  it("bulk restore is blocked entirely when the alias fetch fails", async () => {
    const user = await renderHistory();
    aliasError = { message: "network down" };

    const checkboxes = screen.getAllByLabelText("Select for bulk undo");
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.click(screen.getByText(/Undo 2 selected/));
    await user.click(screen.getByText("Undo all selected"));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(writes).toHaveLength(0);
  });
});
