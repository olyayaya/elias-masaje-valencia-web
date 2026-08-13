import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated } from "../supabase";

export default defineTool({
  name: "conversion_stats",
  title: "Conversion stats",
  description:
    "Summarise website conversion events (WhatsApp clicks, booking submissions, form leads) for the last N days, grouped by event name and page.",
  inputSchema: {
    days: z.number().int().optional().describe("How many days back to include (default 30, max 365)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ days }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated;
    const window = Math.min(Math.max(days ?? 30, 1), 365);
    const since = new Date(Date.now() - window * 86400000).toISOString();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("conversion_events")
      .select("event_name, page_path, locale, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const byEvent: Record<string, number> = {};
    const byPage: Record<string, number> = {};
    const byLocale: Record<string, number> = {};
    (data ?? []).forEach((row) => {
      byEvent[row.event_name] = (byEvent[row.event_name] ?? 0) + 1;
      if (row.page_path) byPage[row.page_path] = (byPage[row.page_path] ?? 0) + 1;
      if (row.locale) byLocale[row.locale] = (byLocale[row.locale] ?? 0) + 1;
    });
    const summary = { days: window, total: data?.length ?? 0, byEvent, byPage, byLocale };
    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: summary,
    };
  },
});
