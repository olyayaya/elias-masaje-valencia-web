import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const LOVABLE_API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LANG_NAMES: Record<string, string> = {
  es: "Spanish",
  en: "English",
  ru: "Russian",
};

const BRAND_SYSTEM = `You are the content writer for Elias Masaje, a professional therapeutic massage studio in central Valencia, Spain.

BRAND VOICE:
- Warm, calm, professional — like a trusted therapist speaking to a friend
- Grounded and honest — no exaggerated claims or medical promises
- Gentle confidence — expertise without arrogance
- Focus on well-being, relief, and personal care
- Non-medical, holistic, premium but simple
- Easy to read — short paragraphs, clear language

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
    const { action, topic, language = "es" } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const langName = LANG_NAMES[language] || "Spanish";

    let messages: { role: string; content: string }[] = [];
    let tools: any[] | undefined;
    let tool_choice: any | undefined;

    if (action === "suggest_topics") {
      messages = [
        { role: "system", content: BRAND_SYSTEM },
        {
          role: "user",
          content: `Suggest 5 blog post topics for Elias Masaje that would perform well for SEO in Valencia.
Each topic should:
- Target a specific search intent related to massage/wellness in Valencia
- Be something a potential client would search for
- Balance informational and commercial intent
- Write titles and reasons in ${langName}

Return the topics.`,
        },
      ];

      tools = [
        {
          type: "function",
          function: {
            name: "return_topics",
            description: "Return blog topic suggestions",
            parameters: {
              type: "object",
              properties: {
                topics: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string", description: `Blog post title in ${langName}` },
                      reason: { type: "string", description: `Why this topic is good for SEO, 1 sentence, in ${langName}` },
                    },
                    required: ["title", "reason"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["topics"],
              additionalProperties: false,
            },
          },
        },
      ];
      tool_choice = { type: "function", function: { name: "return_topics" } };
    } else if (action === "generate_post") {
      messages = [
        { role: "system", content: BRAND_SYSTEM },
        {
          role: "user",
          content: `Write a blog post about: "${topic}"

LANGUAGE: Write the ENTIRE post in ${langName}. Every word must be in ${langName}.

REQUIREMENTS:
- 400-600 words
- Use HTML formatting: <h2>, <h3>, <p>, <ul><li>, <ol><li>, <strong>, <em> — no markdown
- Include relevant keywords naturally 2-3 times
- Open with a hook that addresses the reader's pain point or curiosity
- Include practical advice or insights (not just promotion)
- End with a soft call-to-action mentioning booking a session
- Maintain the warm, professional Elias Masaje brand voice
- Do NOT use clickbait, medical claims, or keyword stuffing
- Keep paragraphs short and easy to scan

Provide the blog post with title, meta description, SEO keywords, and body content — all in ${langName}.`,
        },
      ];

      tools = [
        {
          type: "function",
          function: {
            name: "return_blog_post",
            description: `Return a complete blog post in ${langName}`,
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: `SEO-optimized title under 60 characters in ${langName}` },
                content: { type: "string", description: `Full blog post body as an HTML string in ${langName}` },
                meta_description: { type: "string", description: `Meta description under 155 characters in ${langName}` },
                keywords: {
                  type: "array",
                  items: { type: "string" },
                  description: "3-5 relevant SEO keywords",
                },
              },
              required: ["title", "content", "meta_description", "keywords"],
              additionalProperties: false,
            },
          },
        },
      ];
      tool_choice = { type: "function", function: { name: "return_blog_post" } };
    } else if (action === "regenerate_content") {
      // Regenerate just the body content for an existing post
      messages = [
        { role: "system", content: BRAND_SYSTEM },
        {
          role: "user",
          content: `Rewrite this blog post content about "${topic}" in ${langName}.

LANGUAGE: Write ENTIRELY in ${langName}.

REQUIREMENTS:
- 400-600 words
- Use HTML formatting: <h2>, <h3>, <p>, <ul><li>, <ol><li>, <strong>, <em>
- Fresh perspective on the same topic
- Maintain brand voice: calm, wellness-oriented, holistic, premium but simple
- Do NOT use clickbait, medical claims, or keyword stuffing

Return just the new HTML content.`,
        },
      ];

      tools = [
        {
          type: "function",
          function: {
            name: "return_content",
            description: `Return regenerated blog content in ${langName}`,
            parameters: {
              type: "object",
              properties: {
                content: { type: "string", description: `Regenerated HTML blog content in ${langName}` },
              },
              required: ["content"],
              additionalProperties: false,
            },
          },
        },
      ];
      tool_choice = { type: "function", function: { name: "return_content" } };
    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: any = {
      model: "google/gemini-3-flash-preview",
      messages,
      temperature: action === "suggest_topics" ? 0.7 : 0.5,
    };
    if (tools) body.tools = tools;
    if (tool_choice) body.tool_choice = tool_choice;

    const response = await fetch(LOVABLE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
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

    // Extract from tool call response
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        // For suggest_topics, return the topics array
        if (action === "suggest_topics" && parsed.topics) {
          return new Response(JSON.stringify({ result: parsed.topics }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ result: parsed }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("Failed to parse tool call arguments:", e);
      }
    }

    // Fallback: try to parse from message content
    let raw = data.choices?.[0]?.message?.content?.trim() || "";
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

    try {
      const parsed = JSON.parse(raw);
      return new Response(JSON.stringify({ result: parsed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch {
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
