import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import DashboardCard from "./DashboardCard";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n/context";

type Check = {
  id: string;
  label: string;
  ok: boolean | null;
  detail: string;
};

const COPY = {
  title: { en: "SEO health (live checks)", es: "Salud SEO (comprobaciones en vivo)", ru: "SEO-здоровье (живые проверки)" },
  subtitle: {
    en: "Checked against the running site and your saved settings — not a static checklist.",
    es: "Comprobado contra el sitio en funcionamiento y tus ajustes guardados — no es una lista estática.",
    ru: "Проверяется по работающему сайту и вашим настройкам — это не статичный чек-лист.",
  },
  refresh: { en: "Re-check", es: "Re-comprobar", ru: "Проверить снова" },
  passing: { en: "checks passing", es: "comprobaciones correctas", ru: "проверок пройдено" },
  labels: {
    sitemap: { en: "sitemap.xml reachable", es: "sitemap.xml accesible", ru: "sitemap.xml доступен" },
    robots: { en: "robots.txt reachable", es: "robots.txt accesible", ru: "robots.txt доступен" },
    schema: { en: "LocalBusiness structured data", es: "Datos estructurados LocalBusiness", ru: "Разметка LocalBusiness" },
    ga4: { en: "GA4 measurement ID saved", es: "ID de medición GA4 guardado", ru: "GA4 ID сохранён" },
    gtm: { en: "Google Tag Manager container", es: "Contenedor de Google Tag Manager", ru: "Контейнер Google Tag Manager" },
    gsc: { en: "Search Console verification", es: "Verificación de Search Console", ru: "Подтверждение Search Console" },
    blog: { en: "Fresh blog content", es: "Contenido de blog reciente", ru: "Свежий контент блога" },
    tripadvisor: { en: "TripAdvisor profile linked", es: "Perfil de TripAdvisor enlazado", ru: "Профиль TripAdvisor привязан" },
  },
  notSet: { en: "Not set in Integrations", es: "No configurado en Integraciones", ru: "Не задано в интеграциях" },
  urls: { en: "URLs listed", es: "URLs listadas", ru: "URL в списке" },
  present: { en: "Present on the public site", es: "Presente en el sitio público", ru: "Присутствует на сайте" },
  missing: { en: "Not detected", es: "No detectado", ru: "Не обнаружено" },
  postsPublished: { en: "published posts, newest", es: "artículos publicados, el más reciente", ru: "опубликованных статей, последняя" },
  noPosts: { en: "No published posts yet", es: "Aún no hay artículos publicados", ru: "Пока нет опубликованных статей" },
};

const SeoHealth = () => {
  const { locale } = useI18n();
  const lang: "en" | "es" | "ru" = locale === "ru" ? "ru" : locale === "es" ? "es" : "en";
  const [checks, setChecks] = useState<Check[]>([]);
  const [loading, setLoading] = useState(true);
  const L = COPY.labels;

  const run = async () => {
    setLoading(true);
    const next: Check[] = [];

    // 1. sitemap.xml — fetched live from the running origin.
    try {
      const res = await fetch("/sitemap.xml", { cache: "no-store" });
      const text = res.ok ? await res.text() : "";
      const count = (text.match(/<loc>/g) || []).length;
      next.push({
        id: "sitemap",
        label: L.sitemap[lang],
        ok: res.ok && count > 0,
        detail: res.ok ? `${count} ${COPY.urls[lang]}` : `HTTP ${res.status}`,
      });
    } catch {
      next.push({ id: "sitemap", label: L.sitemap[lang], ok: false, detail: COPY.missing[lang] });
    }

    // 2. robots.txt
    try {
      const res = await fetch("/robots.txt", { cache: "no-store" });
      const text = res.ok ? await res.text() : "";
      next.push({
        id: "robots",
        label: L.robots[lang],
        ok: res.ok && !/^\s*Disallow:\s*\/\s*$/im.test(text),
        detail: res.ok ? `${text.split("\n").filter(Boolean).length} ${lang === "es" ? "líneas" : lang === "ru" ? "строк" : "lines"}` : `HTTP ${res.status}`,
      });
    } catch {
      next.push({ id: "robots", label: L.robots[lang], ok: false, detail: COPY.missing[lang] });
    }

    // 3. Structured data actually present in the served document.
    const ld = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
      .map((n) => n.textContent || "").join(" ");
    const hasLocal = /LocalBusiness|HealthAndBeautyBusiness/.test(ld);
    next.push({
      id: "schema",
      label: L.schema[lang],
      ok: hasLocal,
      detail: hasLocal ? COPY.present[lang] : COPY.missing[lang],
    });

    // 4–6 + 8. Saved integration values.
    const { data: settings } = await supabase
      .from("site_content")
      .select("content_key, value_es")
      .eq("category", "integrations");
    const map: Record<string, string> = {};
    (settings || []).forEach((r: any) => { map[r.content_key] = (r.value_es || "").trim(); });

    const fromSetting = (id: string, key: string, label: string) => {
      const v = map[key];
      next.push({ id, label, ok: !!v, detail: v ? v.slice(0, 42) : COPY.notSet[lang] });
    };
    fromSetting("ga4", "integration_ga4_id", L.ga4[lang]);
    fromSetting("gtm", "integration_gtm_id", L.gtm[lang]);
    fromSetting("gsc", "integration_gsc_verification", L.gsc[lang]);

    // 7. Fresh blog content.
    const { data: posts } = await supabase
      .from("blog_posts")
      .select("id, updated_at, hidden, status")
      .eq("status", "published")
      .eq("hidden", false)
      .order("updated_at", { ascending: false });
    const count = posts?.length || 0;
    const newest = posts?.[0]?.updated_at;
    next.push({
      id: "blog",
      label: L.blog[lang],
      ok: count > 0,
      detail: newest
        ? `${count} ${COPY.postsPublished[lang]} ${new Date(newest).toLocaleDateString(locale)}`
        : COPY.noPosts[lang],
    });

    fromSetting("tripadvisor", "integration_tripadvisor_url", L.tripadvisor[lang]);

    setChecks(next);
    setLoading(false);
  };

  useEffect(() => { void run(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [lang]);

  const passing = checks.filter((c) => c.ok).length;

  return (
    <DashboardCard
      title={COPY.title[lang]}
      description={COPY.subtitle[lang]}
      action={
        <button
          onClick={() => void run()}
          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-secondary transition-colors"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          {COPY.refresh[lang]}
        </button>
      }
    >
      {loading && checks.length === 0 ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" size={18} /></div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{passing}/{checks.length} {COPY.passing[lang]}</p>
          <ul className="space-y-2">
            {checks.map((c) => (
              <li key={c.id} className="flex items-start gap-3">
                {c.ok === true ? (
                  <CheckCircle2 size={16} className="text-green-500 shrink-0 mt-0.5" />
                ) : c.ok === false ? (
                  <XCircle size={16} className="text-destructive shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle size={16} className="text-yellow-500 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className="text-sm text-foreground">{c.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </DashboardCard>
  );
};

export default SeoHealth;
