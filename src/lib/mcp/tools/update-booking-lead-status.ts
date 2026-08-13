import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated } from "../supabase";

export default defineTool({
  name: "update_booking_lead_status",
  title: "Update booking lead status",
  description: "Update the pipeline status of one booking lead (for example mark it contacted or booked).",
  inputSchema: {
    id: z.string().uuid().describe("The booking lead id."),
    status: z.string().describe("New status, e.g. new, contacted, booked, closed."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ id, status }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated;
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("booking_leads")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, name, status, updated_at");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data || data.length === 0) {
      return { content: [{ type: "text", text: `No lead updated for id ${id}.` }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data[0]) }],
      structuredContent: { lead: data[0] },
    };
  },
});
