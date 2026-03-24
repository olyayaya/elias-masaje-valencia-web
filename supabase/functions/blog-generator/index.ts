import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const LOVABLE_API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BRAND_SYSTEM = `You are the content writer for Elias Masaje, a professional therapeutic massage studio in central Valencia, Spain.

BRAND VOICE:
- Warm, calm, professional — like a trusted therapist speaking to a friend
- Use "yo/mi" (first person) when referring to the practitioner
- Grounded and honest — no exaggerated claims or medical promises
- Gentle confidence — expertise without arrogance
- Focus on well-being, relief, and personal care

BUSINESS CONTEXT:
- Located at Calle de la Paz 18, Valencia centro
- Services: deep tissue (descontracturante), relaxation, sports, back & neck, cupping, combined sessions
- Target audience: Valencia residents, office workers, athletes, people with chronic tension
- Key differentiator: personalized one-on-one sessions in a calm, private space

SEO CONTEXT:
- Primary keywords: masaje Valencia, masajista Valencia, masaje terapéutico Valencia
- Secondary: masaje descontracturante, masaje relajante, dolor de espalda, masaje deportivo
- Local SEO focus: Valencia centro, near Plaza del Ayuntamiento
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, topic, language } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let prompt = "";

    if (action === "suggest_topics") {
      prompt = `Suggest 5 blog post topics for Elias Masaje that would perform well for SEO in Valencia.
Each topic should:
- Target a specific search intent related to massage/wellness in Valencia
- Be something a potential client would search for
- Balance informational and commercial intent

Return ONLY a JSON array of objects with "title" (the post title in ${language === "en" ? "English" : language === "ru" ? "Russian" : "Spanish"}) and "reason" (why this topic is good for SEO, 1 sentence, same language). No markdown, no code fences.`;
    } else if (action === "generate_post") {
      const langInstruction = language === "en"
        ? "Write entirely in English."
        : language === "ru"
        ? "Write entirely in Russian."
        : "Write entirely in Spanish.";

      prompt = `Write a blog post about: "${topic}"

${langInstruction}

REQUIREMENTS:
- 400-600 words
- Use HTML formatting (h2, h3, p, ul/li, strong, em) — no markdown
- Include the primary keyword naturally 2-3 times
- Include related secondary keywords where natural
- Open with a hook that addresses the reader's pain point or curiosity
- Include practical advice or insights (not just promotion)
- End with a soft call-to-action mentioning booking a session
- Maintain the warm, professional Elias Masaje brand voice
- Do NOT use clickbait or medical claims

Also provide:
1. An SEO-optimized title (under 60 characters)
2. A meta description (under 155 characters)  
3. 3-5 relevant SEO keywords

Return ONLY a JSON object with keys: "title", "content" (HTML string), "meta_description", "keywords" (array of strings). No markdown, no code fences.`;
    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch(LOVABLE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: BRAND_SYSTEM },
          { role: "user", content: prompt },
        ],
        temperature: action === "suggest_topics" ? 0.7 : 0.5,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited — please wait a moment and try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const err = await response.text();
      console.error("AI gateway error:", status, err);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    let raw = data.choices?.[0]?.message?.content?.trim() || "";

    // Strip markdown code fences if present
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

    try {
      const parsed = JSON.parse(raw);
      return new Response(JSON.stringify({ result: parsed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch {
      // If not valid JSON, return raw text
      return new Response(JSON.stringify({ result: raw }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("blog-generator error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
