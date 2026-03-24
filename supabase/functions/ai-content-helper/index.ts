import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const LOVABLE_API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, action, targetLang, sourceLang } = await req.json();

    let prompt = "";

    if (action === "translate") {
      const langNames: Record<string, string> = { es: "Spanish", en: "English", ru: "Russian" };
      prompt = `Translate the following massage/wellness service description from ${langNames[sourceLang] || sourceLang} to ${langNames[targetLang] || targetLang}. Keep the same tone — professional, warm, concise. Return ONLY the translated text, nothing else.\n\nText: "${text}"`;
    } else if (action === "seo_optimize") {
      prompt = `Improve this massage/wellness service description for SEO performance. It should be compelling, include relevant keywords for "massage Valencia" searches, and stay under 200 characters. Keep the same language as the original. Return ONLY the improved text, nothing else.\n\nOriginal: "${text}"`;
    } else if (action === "suggest_badges") {
      const serviceNames = text;
      prompt = `You are a marketing expert for a massage therapy business in Valencia, Spain called "Elias Masaje". Suggest 6 short promotional badge texts for their services. Mix seasonal offers, discounts, and popularity badges. Each badge should be 2-5 words max in Spanish. Consider the current month and season. Services: ${serviceNames}. Return ONLY a JSON array of objects with "text" (Spanish badge), "text_en" (English), "text_ru" (Russian), and "suggested_days" (number 7-30 for how long the promo should run). Example: [{"text":"Más popular","text_en":"Most popular","text_ru":"Самый популярный","suggested_days":30}]`;
    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      console.error("AI gateway error:", response.status, err);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: `AI API error: ${err}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content?.trim() || "";

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
