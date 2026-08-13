import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated } from "../supabase";

export default defineTool({
  name: "list_services",
  title: "List massage services",
  description:
    "List the massage services published on the Elias Masaje website, including duration, price and translations (ES/EN/RU).",
  inputSchema: {
    includeHidden: z.boolean().optional().describe("Include services hidden from the public site (default false)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ includeHidden }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated;
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("services")
      .select("id, title, title_en, title_ru, duration, price, description, hidden, sort_order")
      .order("sort_order", { ascending: true });
    if (!includeHidden) query = query.eq("hidden", false);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { services: data ?? [] },
    };
  },
});
