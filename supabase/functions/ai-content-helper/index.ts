import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const LOVABLE_API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function requireAdmin(req: Request): Promise<{ ok: true; userId: string } | { ok: false; res: Response }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, res: json({ error: "Unauthorized" }, 401) };
  }
  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: claims, error } = await supabase.auth.getClaims(token);
  if (error || !claims?.claims?.sub) {
    return { ok: false, res: json({ error: "Unauthorized" }, 401) };
  }
  const userId = claims.claims.sub as string;
  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) return { ok: false, res: json({ error: "Forbidden" }, 403) };
  return { ok: true, userId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;

  try {
    const { text, action, targetLang, sourceLang, targets } = await req.json();

    const langNames: Record<string, string> = { es: "Spanish", en: "English", ru: "Russian" };
    const LANGS = ["es", "en", "ru"];
    const MAX_ALT = 125;

    let prompt = "";
    let expectJson = false;

    if (action === "translate_alt") {
      // Localized image alt text: short, factual, no keyword stuffing.
      if (typeof text !== "string" || !text.trim()) return json({ error: "Missing text" }, 400);
      if (text.length > 300) return json({ error: "Text too long" }, 400);
      if (!LANGS.includes(sourceLang)) return json({ error: "Invalid sourceLang" }, 400);
      const wanted = Array.isArray(targets)
        ? targets.filter((t: unknown) => typeof t === "string" && LANGS.includes(t) && t !== sourceLang)
        : LANGS.filter((l) => l !== sourceLang);
      if (wanted.length === 0) return json({ error: "No target languages" }, 400);
      expectJson = true;
      prompt = `Translate this image ALT text from ${langNames[sourceLang]} into: ${wanted.map((l: string) => langNames[l]).join(", ")}.
Rules: it describes a photo on a massage therapy website. Keep it a single short factual sentence describing exactly what the source says. Do NOT add facts, brand names, locations or keywords that are not in the source. No keyword stuffing. Maximum ${MAX_ALT} characters per language.
Return ONLY a JSON object with the keys ${wanted.map((l: string) => `"${l}"`).join(", ")} and string values.

Source (${langNames[sourceLang]}): "${text}"`;
    } else if (action === "translate") {
      prompt = `Translate the following massage/wellness service description from ${langNames[sourceLang] || sourceLang} to ${langNames[targetLang] || targetLang}. Keep the same tone — professional, warm, concise. Return ONLY the translated text, nothing else.\n\nText: "${text}"`;
    } else if (action === "seo_optimize") {
      prompt = `Improve this massage/wellness service description for SEO performance. It should be compelling, include relevant keywords for "massage Valencia" searches, and stay under 200 characters. Keep the same language as the original. Return ONLY the improved text, nothing else.\n\nOriginal: "${text}"`;
    } else if (action === "suggest_badges") {
      const serviceNames = text;
      prompt = `You are a marketing expert for a massage therapy business in Valencia, Spain called "Elias Masaje". Suggest 6 short promotional badge texts for their services. Mix seasonal offers, discounts, and popularity badges. Each badge should be 2-5 words max in Spanish. Consider the current month and season. Services: ${serviceNames}. Return ONLY a JSON array of objects with "text" (Spanish badge), "text_en" (English), "text_ru" (Russian), and "suggested_days" (number 7-30 for how long the promo should run). Example: [{"text":"Más popular","text_en":"Most popular","text_ru":"Самый популярный","suggested_days":30}]`;
    } else {
      return json({ error: "Invalid action" }, 400);
    }


    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      console.error("LOVABLE_API_KEY not configured");
      return json({ error: "AI service is not configured." }, 500);
    }

    const response = await fetch(LOVABLE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
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
      if (response.status === 429) return json({ error: "Rate limited, please try again later." }, 429);
      if (response.status === 402) return json({ error: "AI credits exhausted." }, 402);
      return json({ error: "AI service error. Please try again." }, 502);
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content?.trim() || "";
    return json({ result });
  } catch (error) {
    console.error("Edge function error:", error);
    return json({ error: "Internal server error." }, 500);
  }
});
