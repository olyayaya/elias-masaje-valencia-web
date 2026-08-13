import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated } from "../supabase";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

export default defineTool({
  name: "create_blog_draft",
  title: "Create blog draft",
  description:
    "Create a new blog post in draft status on the Elias Masaje website. The draft stays hidden until it is published from the dashboard.",
  inputSchema: {
    title: z.string().describe("Post title in Spanish."),
    content: z.string().describe("Post body in Spanish (HTML or plain text)."),
    metaDescription: z.string().optional().describe("SEO meta description, ideally under 160 characters."),
    keywords: z.array(z.string()).optional().describe("SEO keywords for the post."),
    slug: z.string().optional().describe("URL slug; generated from the title when omitted."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ title, content, metaDescription, keywords, slug }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated;
    const cleanTitle = title.trim();
    if (!cleanTitle) return { content: [{ type: "text", text: "Title is required." }], isError: true };
    const finalSlug = slugify(slug?.trim() || cleanTitle) || `post-${Date.now()}`;
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("blog_posts")
      .insert({
        title: cleanTitle,
        content,
        slug: finalSlug,
        status: "draft",
        hidden: true,
        meta_description: metaDescription?.slice(0, 300) ?? null,
        seo_keywords: keywords ?? null,
      })
      .select("id, title, slug, status");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Draft created: ${data?.[0]?.title} (/blog/${data?.[0]?.slug})` }],
      structuredContent: { post: data?.[0] },
    };
  },
});
