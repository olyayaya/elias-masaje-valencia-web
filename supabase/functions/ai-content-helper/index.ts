import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const LOVABLE_API_URL = "https://api.lovable.dev/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  try {
    const { text, action, targetLang, sourceLang } = await req.json();
    // action: "translate" | "seo_optimize"

    let prompt = "";

    if (action === "translate") {
      const langNames: Record<string, string> = { es: "Spanish", en: "English", ru: "Russian" };
      prompt = `Translate the following massage/wellness service description from ${langNames[sourceLang] || sourceLang} to ${langNames[targetLang] || targetLang}. Keep the same tone — professional, warm, concise. Return ONLY the translated text, nothing else.\n\nText: "${text}"`;
    } else if (action === "seo_optimize") {
      prompt = `Improve this massage/wellness service description for SEO performance. It should be compelling, include relevant keywords for "massage Valencia" searches, and stay under 200 characters. Keep the same language as the original. Return ONLY the improved text, nothing else.\n\nOriginal: "${text}"`;
    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400 });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), { status: 500 });
    }

    const response = await fetch(LOVABLE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a professional translator and SEO copywriter specializing in massage therapy and wellness businesses in Valencia, Spain." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(JSON.stringify({ error: `AI API error: ${err}` }), {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content?.trim() || "";

    return new Response(JSON.stringify({ result }), {
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
    });
  }
});
