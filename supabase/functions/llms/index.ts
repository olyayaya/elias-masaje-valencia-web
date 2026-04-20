import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const BASE_URL = "https://eliasmas.es";

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const [postsRes, servicesRes] = await Promise.all([
      supabase
        .from("blog_posts")
        .select("slug, title, title_en, meta_description, meta_description_en")
        .eq("status", "published")
        .eq("hidden", false)
        .not("slug", "is", null)
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(50),
      supabase
        .from("services")
        .select("title, title_en, description, description_en, duration, price")
        .eq("hidden", false)
        .order("sort_order", { ascending: true }),
    ]);

    if (postsRes.error) throw postsRes.error;
    if (servicesRes.error) throw servicesRes.error;

    const posts = postsRes.data ?? [];
    const services = servicesRes.data ?? [];

    const lines: string[] = [];

    lines.push("# Elias Masaje");
    lines.push("");
    lines.push(
      "> Therapeutic, deep-tissue and sports massage in central Valencia, Spain. " +
        "Elias Masaje offers personalized massage therapy to relieve tension, improve mobility, and support recovery."
    );
    lines.push("");
    lines.push("Languages: Spanish (es), English (en), Russian (ru)");
    lines.push("Location: Valencia, Spain");
    lines.push("Booking: WhatsApp +34 698 968 007");
    lines.push("");

    lines.push("## Main pages");
    lines.push("");
    lines.push(`- [Home](${BASE_URL}/): Massage therapy in central Valencia.`);
    lines.push(
      `- [Services](${BASE_URL}/servicios): Full list of massage treatments, durations, and prices.`
    );
    lines.push(
      `- [About](${BASE_URL}/sobre-mi): About Elias, training, approach, and philosophy.`
    );
    lines.push(
      `- [Contact](${BASE_URL}/contacto): Address, opening hours, and booking via WhatsApp.`
    );
    lines.push(
      `- [Blog](${BASE_URL}/blog): Articles on massage benefits, recovery, and wellness.`
    );
    lines.push("");

    lines.push("## English versions");
    lines.push("");
    lines.push(`- [Home (EN)](${BASE_URL}/en)`);
    lines.push(`- [Services (EN)](${BASE_URL}/en/services)`);
    lines.push(`- [About (EN)](${BASE_URL}/en/about)`);
    lines.push(`- [Contact (EN)](${BASE_URL}/en/contact)`);
    lines.push(`- [Blog (EN)](${BASE_URL}/en/blog)`);
    lines.push("");

    if (services.length > 0) {
      lines.push("## Services offered");
      lines.push("");
      for (const s of services) {
        const title = s.title_en || s.title;
        const desc = (s.description_en || s.description || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 200);
        const meta = [s.duration, s.price].filter(Boolean).join(" · ");
        lines.push(`- **${title}** (${meta}): ${desc}`);
      }
      lines.push("");
    }

    if (posts.length > 0) {
      lines.push("## Blog posts");
      lines.push("");
      for (const p of posts) {
        const title = p.title_en || p.title;
        const desc = (p.meta_description_en || p.meta_description || "")
          .replace(/\s+/g, " ")
          .trim();
        lines.push(`- [${title}](${BASE_URL}/en/blog/${p.slug}): ${desc}`);
      }
      lines.push("");
    }

    lines.push("## Optional");
    lines.push("");
    lines.push(`- [Sitemap](${BASE_URL}/sitemap.xml)`);
    lines.push(`- [Robots](${BASE_URL}/robots.txt)`);
    lines.push("");

    return new Response(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=60, s-maxage=60",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("llms.txt error:", err);
    return new Response(`# Error\n\n${String(err)}\n`, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
});
