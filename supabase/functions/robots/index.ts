import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const FALLBACK = `User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Twitterbot
Allow: /

User-agent: facebookexternalhit
Allow: /

User-agent: *
Allow: /

Sitemap: https://eliasmas.es/sitemap.xml
`;

Deno.serve(async (_req) => {
  let body = FALLBACK;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase
      .from("site_content")
      .select("value_es")
      .eq("content_key", "robots_txt")
      .maybeSingle();

    if (!error && data?.value_es?.trim()) {
      body = data.value_es;
    }
  } catch (err) {
    console.error("robots.txt DB error, using fallback:", err);
  }

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=60",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
