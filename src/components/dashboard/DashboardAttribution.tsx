import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageCircle, MousePointerClick, Calendar, RefreshCw, ExternalLink } from "lucide-react";
import DashboardCard from "./DashboardCard";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n/context";

type EventRow = {
  id: string;
  event_name: string;
  location: string;
  page_path: string;
  locale: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

type Range = 7 | 30 | 90;

const RANGE_LABELS: Record<Range, { en: string; es: string; ru: string }> = {
  7: { en: "Last 7 days", es: "Últimos 7 días", ru: "Последние 7 дней" },
  30: { en: "Last 30 days", es: "Últimos 30 días", ru: "Последние 30 дней" },
  90: { en: "Last 90 days", es: "Últimos 90 días", ru: "Последние 90 дней" },
};

const COPY = {
  title: { en: "Conversion attribution", es: "Atribución de conversiones", ru: "Атрибуция конверсий" },
  subtitle: {
    en: "Live counts of WhatsApp clicks and contact submissions, captured directly on the site (mirrors GA4 events).",
    es: "Conteos en vivo de clics de WhatsApp y envíos de contacto, capturados directamente en el sitio (refleja los eventos de GA4).",
    ru: "Счётчики кликов WhatsApp и отправок форм контакта в реальном времени, фиксируются на сайте (зеркалирует события GA4).",
  },
  whatsappClicks: { en: "WhatsApp clicks", es: "Clics de WhatsApp", ru: "Клики WhatsApp" },
  contactSubmits: { en: "Contact submissions", es: "Envíos de contacto", ru: "Отправки контактов" },
  topLocations: { en: "Top click locations", es: "Ubicaciones más clicadas", ru: "Топ источников кликов" },
  byDay: { en: "Clicks by day", es: "Clics por día", ru: "Клики по дням" },
  noData: { en: "No events yet — click a WhatsApp CTA on the public site to test.", es: "Sin eventos aún — haz clic en un CTA de WhatsApp en el sitio público para probar.", ru: "Пока нет событий — кликните по CTA WhatsApp на публичном сайте, чтобы проверить." },
  refresh: { en: "Refresh", es: "Actualizar", ru: "Обновить" },
  recent: { en: "Recent events", es: "Eventos recientes", ru: "Последние события" },
};

const startIso = (range: Range) =>
  new Date(Date.now() - range * 24 * 60 * 60 * 1000).toISOString();

const dayKey = (iso: string) => iso.slice(0, 10);

const DashboardAttribution = () => {
  const { locale } = useI18n();
  const lang: "en" | "es" | "ru" = locale === "ru" ? "ru" : locale === "es" ? "es" : "en";
  const [range, setRange] = useState<Range>(30);
  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);
    const { data } = await supabase
      .from("conversion_events")
      .select("id, event_name, location, page_path, locale, created_at, metadata")
      .gte("created_at", startIso(range))
      .order("created_at", { ascending: false })
      .limit(1000);
    setRows((data || []) as EventRow[]);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { load(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [range]);

  const stats = useMemo(() => {
    const wa = rows.filter((r) => r.event_name === "whatsapp_click");
    const ct = rows.filter((r) => r.event_name === "contact_submit");
    const byLocation: Record<string, number> = {};
    wa.forEach((r) => { byLocation[r.location || "(unspecified)"] = (byLocation[r.location || "(unspecified)"] || 0) + 1; });
    const topLocations = Object.entries(byLocation).sort((a, b) => b[1] - a[1]).slice(0, 8);

    const days: Record<string, number> = {};
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      days[d] = 0;
    }
    wa.forEach((r) => { const k = dayKey(r.created_at); if (k in days) days[k] = (days[k] || 0) + 1; });
    const byDay = Object.entries(days);
    const maxDay = Math.max(1, ...byDay.map(([, v]) => v));

    return { waCount: wa.length, ctCount: ct.length, topLocations, byDay, maxDay };
  }, [rows, range]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" size={24} /></div>;

  return (
    <div className="space-y-4">
      <DashboardCard>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-medium text-foreground">{COPY.title[lang]}</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">{COPY.subtitle[lang]}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-secondary p-0.5 rounded-lg">
              {([7, 30, 90] as Range[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    range === r ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r}d
                </button>
              ))}
            </div>
            <button
              onClick={() => load(false)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-50"
            >
              <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
              {COPY.refresh[lang]}
            </button>
          </div>
        </div>
      </DashboardCard>

      {/* Top stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DashboardCard>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
              <MessageCircle size={18} className="text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{COPY.whatsappClicks[lang]} · {RANGE_LABELS[range][lang]}</p>
              <p className="text-3xl font-display text-foreground mt-1">{stats.waCount}</p>
            </div>
          </div>
        </DashboardCard>
        <DashboardCard>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <MousePointerClick size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{COPY.contactSubmits[lang]} · {RANGE_LABELS[range][lang]}</p>
              <p className="text-3xl font-display text-foreground mt-1">{stats.ctCount}</p>
            </div>
          </div>
        </DashboardCard>
      </div>

      {/* Top locations */}
      <DashboardCard>
        <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
          <MousePointerClick size={14} className="text-muted-foreground" /> {COPY.topLocations[lang]}
        </h4>
        {stats.topLocations.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-4">{COPY.noData[lang]}</p>
        ) : (
          <div className="space-y-2">
            {stats.topLocations.map(([loc, count]) => {
              const pct = (count / stats.waCount) * 100;
              return (
                <div key={loc} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-foreground truncate max-w-[60%]">{loc}</span>
                    <span className="text-muted-foreground">{count} · {pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-foreground rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DashboardCard>

      {/* By day sparkline-ish bars */}
      <DashboardCard>
        <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
          <Calendar size={14} className="text-muted-foreground" /> {COPY.byDay[lang]}
        </h4>
        <div className="flex items-end gap-1 h-24">
          {stats.byDay.map(([d, v]) => (
            <div key={d} className="flex-1 flex flex-col justify-end" title={`${d}: ${v}`}>
              <div
                className="bg-foreground/80 rounded-sm hover:bg-primary transition-colors min-h-[2px]"
                style={{ height: `${(v / stats.maxDay) * 100}%` }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground mt-2 font-mono">
          <span>{stats.byDay[0]?.[0]}</span>
          <span>{stats.byDay[stats.byDay.length - 1]?.[0]}</span>
        </div>
      </DashboardCard>

      {/* Recent events table */}
      <DashboardCard>
        <h4 className="text-sm font-medium text-foreground mb-3">{COPY.recent[lang]}</h4>
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-4">{COPY.noData[lang]}</p>
        ) : (
          <div className="overflow-x-auto -mx-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="px-4 py-2 font-medium">When</th>
                  <th className="px-4 py-2 font-medium">Event</th>
                  <th className="px-4 py-2 font-medium">Location</th>
                  <th className="px-4 py-2 font-medium">Page</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 25).map((r) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/40">
                    <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-4 py-2 font-mono">
                      <span className={`px-1.5 py-0.5 rounded ${r.event_name === "whatsapp_click" ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-primary/10 text-primary"}`}>{r.event_name}</span>
                    </td>
                    <td className="px-4 py-2 font-mono text-foreground">{r.location || "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground truncate max-w-[200px]">{r.page_path || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-3 flex items-center gap-1">
          <ExternalLink size={10} />
          {lang === "en"
            ? "For full attribution (campaign source, geo, devices), open Google Analytics → Reports → Engagement → Events."
            : lang === "es"
            ? "Para atribución completa (fuente de campaña, geo, dispositivos), abre Google Analytics → Informes → Interacción → Eventos."
            : "Для полной атрибуции (источник кампании, гео, устройства) откройте Google Analytics → Отчёты → Вовлечённость → События."}
        </p>
      </DashboardCard>
    </div>
  );
};

export default DashboardAttribution;
