import { useEffect, useMemo, useState } from "react";
import { Eye, Users, Globe, RefreshCw, Loader2, FileText } from "lucide-react";
import DashboardCard from "./DashboardCard";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n/context";

type Row = {
  id: string;
  event_name: string;
  page_path: string;
  locale: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

type Range = 7 | 30 | 90;

const COPY = {
  title: { en: "Site traffic (first-party)", es: "Tráfico del sitio (propio)", ru: "Трафик сайта (собственный)" },
  subtitle: {
    en: "Page views measured directly on your site — no Google account needed. GA4 receives the same events.",
    es: "Visitas medidas directamente en tu web — sin necesidad de cuenta de Google. GA4 recibe los mismos eventos.",
    ru: "Просмотры страниц, измеренные прямо на сайте — без аккаунта Google. GA4 получает те же события.",
  },
  views: { en: "Page views", es: "Páginas vistas", ru: "Просмотры" },
  visits: { en: "Visits", es: "Visitas", ru: "Визиты" },
  pages: { en: "Pages seen", es: "Páginas vistas únicas", ru: "Уникальные страницы" },
  topPages: { en: "Top pages", es: "Páginas más vistas", ru: "Топ страниц" },
  byDay: { en: "Views by day", es: "Visitas por día", ru: "Просмотры по дням" },
  byLang: { en: "By language", es: "Por idioma", ru: "По языку" },
  referrers: { en: "Top referrers", es: "Principales referentes", ru: "Источники переходов" },
  direct: { en: "Direct / none", es: "Directo / sin referente", ru: "Прямой заход" },
  none: {
    en: "No page views recorded yet in this window. Data starts collecting as soon as visitors browse the public site.",
    es: "Aún no hay visitas en este periodo. Los datos empiezan a registrarse en cuanto haya visitantes en el sitio público.",
    ru: "За этот период просмотров пока нет. Данные начнут собираться, как только посетители зайдут на сайт.",
  },
  refresh: { en: "Refresh", es: "Actualizar", ru: "Обновить" },
};

const RANGE_LABELS: Record<Range, { en: string; es: string; ru: string }> = {
  7: { en: "7 days", es: "7 días", ru: "7 дней" },
  30: { en: "30 days", es: "30 días", ru: "30 дней" },
  90: { en: "90 days", es: "90 días", ru: "90 дней" },
};

const startIso = (range: Range) => new Date(Date.now() - range * 864e5).toISOString();

const topOf = (map: Map<string, number>, limit = 6) =>
  [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);

/** Real page-view analytics from our own `conversion_events` table. */
const SeoTraffic = () => {
  const { locale } = useI18n();
  const lang: "en" | "es" | "ru" = locale === "ru" ? "ru" : locale === "es" ? "es" : "en";
  const [range, setRange] = useState<Range>(30);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (spinner = true) => {
    spinner ? setLoading(true) : setRefreshing(true);
    const { data } = await supabase
      .from("conversion_events")
      .select("id, event_name, page_path, locale, created_at, metadata")
      .eq("event_name", "page_view")
      .gte("created_at", startIso(range))
      .order("created_at", { ascending: false })
      .limit(5000);
    setRows((data as Row[]) || []);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [range]);

  const stats = useMemo(() => {
    const pages = new Map<string, number>();
    const days = new Map<string, number>();
    const langs = new Map<string, number>();
    const refs = new Map<string, number>();
    const visits = new Set<string>();

    for (const r of rows) {
      const path = r.page_path || "/";
      pages.set(path, (pages.get(path) || 0) + 1);
      const day = r.created_at.slice(0, 10);
      days.set(day, (days.get(day) || 0) + 1);
      const l = (r.locale || "es").slice(0, 2);
      langs.set(l, (langs.get(l) || 0) + 1);
      const meta = (r.metadata || {}) as Record<string, string>;
      const ref = (meta.referrer || "").trim();
      let host = COPY.direct[lang];
      if (ref) { try { host = new URL(ref).hostname.replace(/^www\./, ""); } catch { host = ref; } }
      refs.set(host, (refs.get(host) || 0) + 1);
      if (meta.visit) visits.add(meta.visit);
    }

    return {
      views: rows.length,
      visits: visits.size,
      pages,
      days: [...days.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      langs: topOf(langs, 3),
      refs: topOf(refs, 5),
    };
  }, [rows, lang]);

  const maxDay = Math.max(1, ...stats.days.map(([, v]) => v));

  return (
    <DashboardCard
      title={COPY.title[lang]}
      description={COPY.subtitle[lang]}
      action={
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {([7, 30, 90] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-2.5 py-1 text-xs transition-colors ${range === r ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60"}`}
              >
                {RANGE_LABELS[r][lang]}
              </button>
            ))}
          </div>
          <button
            onClick={() => load(false)}
            className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-secondary transition-colors"
            aria-label={COPY.refresh[lang]}
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      }
    >
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" size={18} /></div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: COPY.views[lang], value: stats.views, icon: Eye },
              { label: COPY.visits[lang], value: stats.visits, icon: Users },
              { label: COPY.pages[lang], value: stats.pages.size, icon: FileText },
            ].map((c) => (
              <div key={c.label} className="rounded-xl border border-border bg-secondary/30 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <c.icon size={13} className="text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{c.label}</span>
                </div>
                <p className="text-xl font-semibold text-foreground">{c.value.toLocaleString(locale)}</p>
              </div>
            ))}
          </div>

          {stats.views === 0 ? (
            <p className="text-xs text-muted-foreground leading-relaxed">{COPY.none[lang]}</p>
          ) : (
            <>
              <div>
                <p className="text-xs font-medium text-foreground mb-2">{COPY.byDay[lang]}</p>
                <div className="flex items-end gap-1 h-20">
                  {stats.days.map(([day, v]) => (
                    <div key={day} className="flex-1 min-w-[3px] bg-primary/70 rounded-t" style={{ height: `${(v / maxDay) * 100}%` }} title={`${day}: ${v}`} />
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-medium text-foreground mb-2">{COPY.topPages[lang]}</p>
                  <ul className="space-y-1.5">
                    {topOf(stats.pages).map(([path, v]) => (
                      <li key={path} className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate text-muted-foreground">{path}</span>
                        <span className="text-foreground font-medium shrink-0">{v}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-foreground mb-2">{COPY.byLang[lang]}</p>
                    <div className="flex flex-wrap gap-2">
                      {stats.langs.map(([l, v]) => (
                        <span key={l} className="text-xs px-2 py-1 rounded-full bg-secondary text-muted-foreground">
                          <Globe size={11} className="inline mr-1 -mt-0.5" />{l.toUpperCase()} · {v}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground mb-2">{COPY.referrers[lang]}</p>
                    <ul className="space-y-1.5">
                      {stats.refs.map(([host, v]) => (
                        <li key={host} className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate text-muted-foreground">{host}</span>
                          <span className="text-foreground font-medium shrink-0">{v}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </DashboardCard>
  );
};

export default SeoTraffic;
