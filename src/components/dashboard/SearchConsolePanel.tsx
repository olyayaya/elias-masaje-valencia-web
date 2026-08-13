import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, MousePointerClick, Eye, Percent, TrendingUp, AlertCircle } from "lucide-react";
import DashboardCard from "./DashboardCard";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n/context";

type Lang = "en" | "es" | "ru";

interface RowItem {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface GscData {
  siteUrl: string;
  range: { startDate: string; endDate: string; days: number };
  totals: { clicks: number; impressions: number; ctr: number; position: number };
  byDate: { date: string; clicks: number; impressions: number }[];
  topQueries: RowItem[];
  topPages: RowItem[];
  countries: { key: string; clicks: number; impressions: number }[];
  sitemap: { path: string; errors: number; warnings: number; lastSubmitted?: string } | null;
  fetchedAt: string;
}

const COPY = {
  title: { en: "Google Search Console", es: "Google Search Console", ru: "Google Search Console" },
  subtitle: {
    en: "Real Google search data for eliasmas.es — clicks, impressions and the queries people use.",
    es: "Datos reales de búsqueda de Google para eliasmas.es — clics, impresiones y las palabras que usa la gente.",
    ru: "Реальные данные поиска Google для eliasmas.es — клики, показы и поисковые запросы.",
  },
  clicks: { en: "Clicks", es: "Clics", ru: "Клики" },
  impressions: { en: "Impressions", es: "Impresiones", ru: "Показы" },
  ctr: { en: "CTR", es: "CTR", ru: "CTR" },
  position: { en: "Avg. position", es: "Posición media", ru: "Средняя позиция" },
  topQueries: { en: "Top search queries", es: "Búsquedas principales", ru: "Топ запросов" },
  topPages: { en: "Top pages", es: "Páginas principales", ru: "Топ страниц" },
  sitemap: { en: "Sitemap", es: "Sitemap", ru: "Карта сайта" },
  refresh: { en: "Refresh", es: "Actualizar", ru: "Обновить" },
  empty: {
    en: "Google has no search data for this period yet. New sites usually take 1–3 weeks to appear.",
    es: "Google todavía no tiene datos de búsqueda para este periodo. Los sitios nuevos suelen tardar 1–3 semanas.",
    ru: "У Google пока нет данных за этот период. Новым сайтам обычно нужно 1–3 недели.",
  },
  errors: { en: "errors", es: "errores", ru: "ошибок" },
  warnings: { en: "warnings", es: "avisos", ru: "предупреждений" },
  updated: { en: "Data through", es: "Datos hasta", ru: "Данные по" },
} as const;

const fmt = (n: number) => n.toLocaleString();

const Stat = ({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: string }) => (
  <div className="rounded-lg border border-border bg-card/60 p-3">
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      <span className="truncate">{label}</span>
    </div>
    <p className="mt-1 text-xl font-headline">{value}</p>
  </div>
);

const RowList = ({ title, rows, lang }: { title: string; rows: RowItem[]; lang: Lang }) => (
  <div className="space-y-2">
    <p className="text-sm font-medium">{title}</p>
    {rows.length === 0 ? (
      <p className="text-xs text-muted-foreground">{COPY.empty[lang]}</p>
    ) : (
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-3 text-xs border-b border-border/50 py-1.5">
            <span className="truncate" title={r.key}>{r.key.replace("https://eliasmas.es", "") || "/"}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {fmt(r.clicks)} · {fmt(r.impressions)} · #{r.position.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    )}
  </div>
);

/** Live Google Search Console data via the connected Google account. */
const SearchConsolePanel = () => {
  const { locale } = useI18n();
  const lang: Lang = locale === "ru" ? "ru" : locale === "es" ? "es" : "en";
  const [data, setData] = useState<GscData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res, error: err } = await supabase.functions.invoke("search-console", {
        body: { days: 28 },
      });
      if (err) throw err;
      if ((res as { error?: string })?.error) throw new Error((res as { error: string }).error);
      setData(res as GscData);
    } catch (e) {
      setError((e as Error).message || "Request failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <DashboardCard
      title={COPY.title[lang]}
      description={COPY.subtitle[lang]}
      action={
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {COPY.refresh[lang]}
        </button>
      }
    >
      {loading && !data ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
          <Loader2 className="h-4 w-4 animate-spin" /> …
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      ) : data ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat icon={MousePointerClick} label={COPY.clicks[lang]} value={fmt(data.totals.clicks)} />
            <Stat icon={Eye} label={COPY.impressions[lang]} value={fmt(data.totals.impressions)} />
            <Stat icon={Percent} label={COPY.ctr[lang]} value={`${(data.totals.ctr * 100).toFixed(1)}%`} />
            <Stat icon={TrendingUp} label={COPY.position[lang]} value={data.totals.position ? data.totals.position.toFixed(1) : "—"} />
          </div>

          <RowList title={COPY.topQueries[lang]} rows={data.topQueries} lang={lang} />
          <RowList title={COPY.topPages[lang]} rows={data.topPages} lang={lang} />

          {data.sitemap && (
            <p className="text-xs text-muted-foreground">
              {COPY.sitemap[lang]}: {data.sitemap.path.replace("https://eliasmas.es", "")} — {data.sitemap.errors} {COPY.errors[lang]}, {data.sitemap.warnings} {COPY.warnings[lang]}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {COPY.updated[lang]} {data.range.endDate} ({data.range.days}d)
          </p>
        </div>
      ) : null}
    </DashboardCard>
  );
};

export default SearchConsolePanel;
