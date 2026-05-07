import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";
import { useHead } from "@/hooks/use-head";

type Status = "ok" | "fail" | "missing" | "pending";

interface CheckRow {
  label: string;
  status: Status;
  detail?: string;
}

const COPY = {
  es: {
    title: "Verificación de Analítica",
    subtitle: "Diagnóstico en vivo de GA4 y Google Tag Manager",
    ga4: "Google Analytics 4",
    gtm: "Google Tag Manager",
    activeId: "ID activo",
    notConfigured: "Sin configurar",
    scriptLoaded: "Script cargado",
    scriptFailed: "Script no cargado",
    gtagReady: "gtag() disponible",
    gtagMissing: "gtag() no disponible",
    dataLayerReady: "dataLayer inicializado",
    dataLayerMissing: "dataLayer no encontrado",
    gtmContainer: "Contenedor GTM activo",
    gtmContainerMissing: "Contenedor GTM no detectado",
    networkOk: "Red: solicitud a googletagmanager.com confirmada",
    networkFail: "Red: ninguna solicitud a googletagmanager.com",
    refresh: "Volver a comprobar",
    back: "Volver al inicio",
    note: "Esta página se omite del seguimiento. Abrir en una pestaña normal (no en modo incógnito con bloqueadores) para resultados precisos.",
    summary: "Resumen",
    allOk: "Todo funciona correctamente",
    someFail: "Hay problemas que requieren atención",
    noTrack: "No hay analítica configurada",
  },
  en: {
    title: "Analytics Verification",
    subtitle: "Live diagnostics for GA4 and Google Tag Manager",
    ga4: "Google Analytics 4",
    gtm: "Google Tag Manager",
    activeId: "Active ID",
    notConfigured: "Not configured",
    scriptLoaded: "Script loaded",
    scriptFailed: "Script failed to load",
    gtagReady: "gtag() available",
    gtagMissing: "gtag() unavailable",
    dataLayerReady: "dataLayer initialized",
    dataLayerMissing: "dataLayer not found",
    gtmContainer: "GTM container active",
    gtmContainerMissing: "GTM container not detected",
    networkOk: "Network: request to googletagmanager.com confirmed",
    networkFail: "Network: no request to googletagmanager.com",
    refresh: "Re-run checks",
    back: "Back to home",
    note: "This page is excluded from tracking itself. Open in a normal tab (no ad blockers) for accurate results.",
    summary: "Summary",
    allOk: "Everything is working",
    someFail: "Issues need attention",
    noTrack: "No analytics configured",
  },
  ru: {
    title: "Проверка аналитики",
    subtitle: "Живая диагностика GA4 и Google Tag Manager",
    ga4: "Google Analytics 4",
    gtm: "Google Tag Manager",
    activeId: "Активный ID",
    notConfigured: "Не настроено",
    scriptLoaded: "Скрипт загружен",
    scriptFailed: "Скрипт не загрузился",
    gtagReady: "gtag() доступен",
    gtagMissing: "gtag() недоступен",
    dataLayerReady: "dataLayer инициализирован",
    dataLayerMissing: "dataLayer не найден",
    gtmContainer: "Контейнер GTM активен",
    gtmContainerMissing: "Контейнер GTM не обнаружен",
    networkOk: "Сеть: запрос к googletagmanager.com подтверждён",
    networkFail: "Сеть: запросы к googletagmanager.com не найдены",
    refresh: "Перепроверить",
    back: "На главную",
    note: "Эта страница исключена из отслеживания. Откройте в обычной вкладке (без блокировщиков) для точных результатов.",
    summary: "Итог",
    allOk: "Всё работает корректно",
    someFail: "Есть проблемы",
    noTrack: "Аналитика не настроена",
  },
} as const;

const StatusIcon = ({ s }: { s: Status }) => {
  if (s === "ok") return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (s === "fail") return <XCircle className="h-4 w-4 text-destructive" />;
  if (s === "missing") return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
  return <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />;
};

export default function AnalyticsCheck() {
  const { lang } = useI18n();
  const t = COPY[(lang as keyof typeof COPY)] || COPY.es;
  const [ga4Id, setGa4Id] = useState<string | null>(null);
  const [gtmId, setGtmId] = useState<string | null>(null);
  const [ga4Checks, setGa4Checks] = useState<CheckRow[]>([]);
  const [gtmChecks, setGtmChecks] = useState<CheckRow[]>([]);
  const [tick, setTick] = useState(0);

  useHead({ title: t.title, description: t.subtitle, noindex: true });

  // Load IDs once
  useEffect(() => {
    supabase
      .from("site_content")
      .select("content_key, value_es")
      .eq("category", "integrations")
      .in("content_key", ["integration_ga4_id", "integration_gtm_id"])
      .then(({ data }) => {
        const map: Record<string, string> = {};
        data?.forEach((r: any) => { if (r.value_es?.trim()) map[r.content_key] = r.value_es.trim(); });
        const ga = map.integration_ga4_id;
        const gt = map.integration_gtm_id;
        setGa4Id(ga && /^G-[A-Z0-9]+$/i.test(ga) ? ga : null);
        setGtmId(gt && /^GTM-[A-Z0-9]+$/i.test(gt) ? gt : null);
      });
  }, []);

  // Run checks (re-run on tick)
  useEffect(() => {
    const run = () => {
      const w = window as any;
      const scripts = Array.from(document.scripts).map((s) => s.src);
      const hasGa4Script = ga4Id ? scripts.some((s) => s.includes(`googletagmanager.com/gtag/js`) && s.includes(ga4Id)) : false;
      const hasGtmScript = gtmId ? scripts.some((s) => s.includes(`googletagmanager.com/gtm.js`) && s.includes(gtmId)) : false;
      const hasDataLayer = Array.isArray(w.dataLayer);
      const hasGtag = typeof w.gtag === "function";
      const hasGtmContainer = gtmId ? !!(w.google_tag_manager && w.google_tag_manager[gtmId]) : false;

      if (ga4Id) {
        setGa4Checks([
          { label: hasGa4Script ? t.scriptLoaded : t.scriptFailed, status: hasGa4Script ? "ok" : "fail" },
          { label: hasGtag ? t.gtagReady : t.gtagMissing, status: hasGtag ? "ok" : "fail" },
          { label: hasDataLayer ? t.dataLayerReady : t.dataLayerMissing, status: hasDataLayer ? "ok" : "fail" },
        ]);
      } else {
        setGa4Checks([]);
      }

      if (gtmId) {
        setGtmChecks([
          { label: hasGtmScript ? t.scriptLoaded : t.scriptFailed, status: hasGtmScript ? "ok" : "fail" },
          { label: hasDataLayer ? t.dataLayerReady : t.dataLayerMissing, status: hasDataLayer ? "ok" : "fail" },
          { label: hasGtmContainer ? t.gtmContainer : t.gtmContainerMissing, status: hasGtmContainer ? "ok" : "fail" },
        ]);
      } else {
        setGtmChecks([]);
      }
    };

    // wait for scripts to settle
    const timers = [setTimeout(run, 400), setTimeout(run, 1500), setTimeout(run, 3500)];
    return () => timers.forEach(clearTimeout);
  }, [ga4Id, gtmId, tick, t]);

  const summarize = (checks: CheckRow[]) => {
    if (!checks.length) return "missing";
    if (checks.every((c) => c.status === "ok")) return "ok";
    return "fail";
  };

  const ga4Sum = ga4Id ? summarize(ga4Checks) : "missing";
  const gtmSum = gtmId ? summarize(gtmChecks) : "missing";
  const allMissing = !ga4Id && !gtmId;
  const allOk = (ga4Id ? ga4Sum === "ok" : true) && (gtmId ? gtmSum === "ok" : true) && !allMissing;

  return (
    <div className="container max-w-3xl py-12 md:py-20 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-headline">{t.title}</h1>
        <p className="text-muted-foreground">{t.subtitle}</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">{t.summary}</CardTitle>
          <Badge variant={allOk ? "default" : allMissing ? "secondary" : "destructive"}>
            {allMissing ? t.noTrack : allOk ? t.allOk : t.someFail}
          </Badge>
        </CardHeader>
      </Card>

      {/* GA4 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <StatusIcon s={ga4Sum as Status} />
              {t.ga4}
            </CardTitle>
            <code className="text-xs bg-muted px-2 py-1 rounded">
              {ga4Id ? `${t.activeId}: ${ga4Id}` : t.notConfigured}
            </code>
          </div>
        </CardHeader>
        {ga4Id && (
          <CardContent className="space-y-2">
            {ga4Checks.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" /> …
              </div>
            ) : (
              ga4Checks.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <StatusIcon s={c.status} />
                  <span>{c.label}</span>
                </div>
              ))
            )}
          </CardContent>
        )}
      </Card>

      {/* GTM */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <StatusIcon s={gtmSum as Status} />
              {t.gtm}
            </CardTitle>
            <code className="text-xs bg-muted px-2 py-1 rounded">
              {gtmId ? `${t.activeId}: ${gtmId}` : t.notConfigured}
            </code>
          </div>
        </CardHeader>
        {gtmId && (
          <CardContent className="space-y-2">
            {gtmChecks.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" /> …
              </div>
            ) : (
              gtmChecks.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <StatusIcon s={c.status} />
                  <span>{c.label}</span>
                </div>
              ))
            )}
          </CardContent>
        )}
      </Card>

      <p className="text-xs text-muted-foreground">{t.note}</p>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setTick((n) => n + 1)} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" /> {t.refresh}
        </Button>
        <Button asChild variant="ghost">
          <Link to={lang === "es" ? "/" : `/${lang}`}>
            <ArrowLeft className="h-4 w-4 mr-2" /> {t.back}
          </Link>
        </Button>
      </div>
    </div>
  );
}
