import { useEffect, useState } from "react";
import { Save, Loader2, ExternalLink, CheckCircle2, Circle, Eye, EyeOff, Languages, Activity, AlertCircle, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import DashboardCard from "./DashboardCard";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import IntegrationDiagnostics from "./IntegrationDiagnostics";
import { logDiagnostic, describeError } from "@/lib/integration-diagnostics";

type TestStatus = { ok: boolean; error?: string; details?: string; testedAt: string };
const TEST_CACHE_KEY = "integration_test_results_v1";

const loadTestCache = (): Record<string, TestStatus> => {
  try { return JSON.parse(localStorage.getItem(TEST_CACHE_KEY) || "{}"); } catch { return {}; }
};
const saveTestCache = (m: Record<string, TestStatus>) => {
  try { localStorage.setItem(TEST_CACHE_KEY, JSON.stringify(m)); } catch {}
};

const formatRelative = (iso: string, lang: "en" | "ru") => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return lang === "en" ? "just now" : "только что";
  if (m < 60) return lang === "en" ? `${m} min ago` : `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return lang === "en" ? `${h}h ago` : `${h} ч назад`;
  const d = Math.floor(h / 24);
  return lang === "en" ? `${d}d ago` : `${d} дн назад`;
};

type DocLang = "en" | "ru";

interface Field {
  key: string;
  label: string;
  placeholder: string;
  validate?: (v: string) => boolean;
  secret?: boolean;
  docs: { url: string; label: string };
  instructions: Record<DocLang, string[]>;
}

const FIELDS: Field[] = [
  {
    key: "integration_ga4_id",
    label: "Google Analytics 4 — Measurement ID",
    placeholder: "G-XXXXXXXXXX",
    validate: (v) => !v || /^G-[A-Z0-9]+$/i.test(v.trim()),
    docs: { url: "https://analytics.google.com/", label: "analytics.google.com" },
    instructions: {
      en: [
        "Go to analytics.google.com and sign in with your Google Workspace / Gmail account.",
        "Click Admin (gear icon, bottom left) → Create → Property.",
        "Enter property name (e.g. \"Elias Masaje\"), set timezone Europe/Madrid and currency EUR.",
        "Choose \"Web\" platform, enter https://eliasmas.es as the website URL.",
        "Copy the Measurement ID (starts with G-) and paste it below.",
      ],
      ru: [
        "Откройте analytics.google.com и войдите под Google Workspace / Gmail аккаунтом.",
        "Нажмите Admin (шестерёнка, слева внизу) → Create → Property.",
        "Введите название (например \"Elias Masaje\"), часовой пояс Europe/Madrid, валюта EUR.",
        "Выберите платформу «Web», укажите URL сайта https://eliasmas.es.",
        "Скопируйте Measurement ID (начинается с G-) и вставьте его ниже.",
      ],
    },
  },
  {
    key: "integration_gtm_id",
    label: "Google Tag Manager — Container ID",
    placeholder: "GTM-XXXXXXX",
    validate: (v) => !v || /^GTM-[A-Z0-9]+$/i.test(v.trim()),
    docs: { url: "https://tagmanager.google.com/", label: "tagmanager.google.com" },
    instructions: {
      en: [
        "Open tagmanager.google.com and sign in.",
        "Click Create Account → enter account & container name (e.g. \"eliasmas.es\").",
        "Choose Web as the target platform and accept the Terms.",
        "On the install screen copy the GTM-XXXXXXX container ID and paste it below.",
        "Tags inside the container will load automatically — no further code is needed.",
      ],
      ru: [
        "Откройте tagmanager.google.com и войдите.",
        "Нажмите Create Account → укажите название аккаунта и контейнера (например \"eliasmas.es\").",
        "Выберите платформу Web и примите условия использования.",
        "На экране установки скопируйте ID контейнера GTM-XXXXXXX и вставьте ниже.",
        "Теги внутри контейнера подключатся автоматически — менять код сайта не нужно.",
      ],
    },
  },
  {
    key: "integration_gsc_verification",
    label: "Google Search Console — Verification code",
    placeholder: "<meta …/>, just the code, or googleXXXX.html",
    docs: { url: "https://search.google.com/search-console", label: "search.google.com/search-console" },
    instructions: {
      en: [
        "Open search.google.com/search-console and sign in.",
        "Click Add property → choose URL prefix → enter https://eliasmas.es.",
        "Pick verification method \"HTML tag\" and copy the full <meta> tag (or just the content value).",
        "Or paste the HTML file reference (e.g. google1a2b3c.html) — we extract the token automatically.",
        "Paste it below and Save — the tag appears in the site head; status auto-checks below.",
        "Return to Search Console and click Verify.",
      ],
      ru: [
        "Откройте search.google.com/search-console и войдите.",
        "Нажмите Add property → URL prefix → введите https://eliasmas.es.",
        "Выберите способ подтверждения «HTML tag» и скопируйте весь <meta>-тег (или только значение content).",
        "Или вставьте имя HTML-файла (например google1a2b3c.html) — токен извлечётся автоматически.",
        "Вставьте значение ниже и сохраните — тег автоматически появится в <head> сайта, статус проверится ниже.",
        "Вернитесь в Search Console и нажмите Verify.",
      ],
    },
  },
  {
    key: "integration_google_workspace_verification",
    label: "Google Workspace — Domain verification",
    placeholder: "<meta …/>, just the code, or googleXXXX.html",
    docs: { url: "https://admin.google.com/", label: "admin.google.com" },
    instructions: {
      en: [
        "Open admin.google.com and sign in as the Workspace super-admin.",
        "Go to Account → Domains → Manage domains, click Add a domain (or open the unverified domain).",
        "Choose verification method \"Add a meta tag to your site's home page\".",
        "Copy the full <meta name=\"google-site-verification\" …> tag (or just the content value).",
        "Or paste the HTML file reference (e.g. google1a2b3c.html) — we extract the token automatically.",
        "Paste it below and Save — the tag goes live in the site head; status auto-checks below.",
        "Return to the Google Admin console and click Verify.",
        "Note: this is a separate token from Search Console — both can coexist on the same site.",
      ],
      ru: [
        "Откройте admin.google.com и войдите как супер-админ Workspace.",
        "Перейдите Account → Domains → Manage domains, нажмите Add a domain (или откройте неподтверждённый домен).",
        "Выберите способ подтверждения «Add a meta tag to your site's home page».",
        "Скопируйте весь тег <meta name=\"google-site-verification\" …> (или только значение content).",
        "Или вставьте имя HTML-файла (например google1a2b3c.html) — токен извлечётся автоматически.",
        "Вставьте значение ниже и сохраните — тег появится в <head> сайта, статус проверится ниже.",
        "Вернитесь в Google Admin и нажмите Verify.",
        "Примечание: это отдельный токен от Search Console — оба могут сосуществовать.",
      ],
    },
  },
  {
    key: "integration_tripadvisor_url",
    label: "TripAdvisor — Business profile URL",
    placeholder: "https://www.tripadvisor.com/Attraction_Review-…",
    validate: (v) => !v || /^https?:\/\/(www\.)?tripadvisor\.[a-z.]+\//i.test(v.trim()),
    docs: { url: "https://www.tripadvisor.com/Owners", label: "tripadvisor.com/Owners" },
    instructions: {
      en: [
        "Open tripadvisor.com/Owners and claim your business listing (free).",
        "Once your listing is live, open its public page on TripAdvisor.",
        "Copy the full URL from the browser address bar (e.g. https://www.tripadvisor.com/Attraction_Review-g187529-…).",
        "Paste it below and Save — we use it for the \"Reviews\" link and structured-data rich results.",
        "Test below to confirm the page is publicly reachable.",
      ],
      ru: [
        "Откройте tripadvisor.com/Owners и подтвердите права на вашу карточку (бесплатно).",
        "Когда карточка опубликована, откройте её публичную страницу на TripAdvisor.",
        "Скопируйте полный URL из адресной строки браузера (например https://www.tripadvisor.com/Attraction_Review-g187529-…).",
        "Вставьте его ниже и сохраните — используется для ссылки «Отзывы» и расширенных результатов поиска.",
        "Нажмите «Тест», чтобы убедиться, что страница доступна публично.",
      ],
    },
  },
  {
    key: "integration_seo_api_key",
    label: "SEO tool — API key (Ahrefs / SEMrush / Serpstat / etc.)",
    placeholder: "Paste API key",
    secret: true,
    docs: { url: "https://ahrefs.com/api", label: "Provider docs" },
    instructions: {
      en: [
        "Sign in to your SEO provider (Ahrefs, SEMrush, Serpstat, …).",
        "Open API section of your account settings and generate a new API key.",
        "Copy the key and paste it below — it stays private to your dashboard.",
        "We'll use it later to pull live ranking data into this dashboard.",
      ],
      ru: [
        "Войдите в свой SEO-сервис (Ahrefs, SEMrush, Serpstat, …).",
        "В настройках аккаунта откройте раздел API и сгенерируйте новый ключ.",
        "Скопируйте ключ и вставьте ниже — он виден только в вашей панели.",
        "Позже мы используем его для загрузки данных о позициях в этот дашборд.",
      ],
    },
  },
];

const DashboardIntegrations = () => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [original, setOriginal] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [docLang, setDocLang] = useState<DocLang>("en");
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<string, TestStatus>>(loadTestCache);
  const [connectorGa4Id, setConnectorGa4Id] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const connectorGa4 = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY?.trim() || null;
    setConnectorGa4Id(connectorGa4);

    supabase
      .from("site_content")
      .select("content_key, value_es")
      .eq("category", "integrations")
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data || []).forEach((r: any) => { map[r.content_key] = r.value_es || ""; });
        // The connected Google Analytics connector takes precedence for GA4.
        if (connectorGa4) map.integration_ga4_id = connectorGa4;
        setValues(map);
        setOriginal(map);
        setLoading(false);

        // Auto-verify saved verification meta tags (refresh stale results)
        const cache = loadTestCache();
        const STALE_MS = 10 * 60 * 1000; // 10 min
        const verificationKeys = [
          "integration_gsc_verification",
          "integration_google_workspace_verification",
        ];
        verificationKeys.forEach(async (k) => {
          const v = (map[k] || "").trim();
          if (!v) return;
          const cached = cache[k];
          if (cached && Date.now() - new Date(cached.testedAt).getTime() < STALE_MS) return;
          try {
            const { data: res, error } = await supabase.functions.invoke("test-integration", {
              body: { kind: k, value: v },
            });
            const result: TestStatus = error
              ? { ok: false, error: error.message, testedAt: new Date().toISOString() }
              : { ok: !!res?.ok, error: res?.error, details: res?.details, testedAt: res?.testedAt || new Date().toISOString() };
            setTests((prev) => {
              const next = { ...prev, [k]: result };
              saveTestCache(next);
              return next;
            });
          } catch {/* ignore — manual Test still available */}
        });
      })
      .then(undefined, () => setLoading(false));
  }, []);

  const labelFor = (key: string) => FIELDS.find((f) => f.key === key)?.label || key;

  const save = async (key: string) => {
    setSavingKey(key);
    const v = (values[key] || "").trim();
    const started = Date.now();
    try {
      const { error } = await supabase
        .from("site_content")
        .update({ value_es: v, value_en: v, value_ru: v, updated_at: new Date().toISOString() })
        .eq("content_key", key);
      if (error) throw error;
      setOriginal((prev) => ({ ...prev, [key]: v }));
      queryClient.invalidateQueries({ queryKey: queryKeys.siteContent });
      logDiagnostic({
        action: "save",
        target: key,
        label: labelFor(key),
        ok: true,
        details: v ? undefined : "Value cleared",
        durationMs: Date.now() - started,
      });
      // Auto re-test so the live status badge updates without reload.
      // Verification metas need a beat for the injector / cached HTML to refresh.
      if (v) {
        const delay = key.endsWith("_verification") ? 1500 : 200;
        setTimeout(() => { runTest(key, v).catch(() => {}); }, delay);
      } else {
        // Cleared value → drop stale test result
        setTests((prev) => {
          const next = { ...prev }; delete next[key]; saveTestCache(next); return next;
        });
      }
    } catch (e) {
      const msg = describeError(e);
      logDiagnostic({
        action: "save",
        target: key,
        label: labelFor(key),
        ok: false,
        error: msg,
        durationMs: Date.now() - started,
      });
      setTests((prev) => {
        const next = { ...prev, [key]: { ok: false, error: msg, testedAt: new Date().toISOString() } };
        saveTestCache(next);
        return next;
      });
    } finally {
      setSavingKey(null);
    }
  };

  const runTest = async (key: string, override?: string, action: "test" | "refresh" = "test") => {
    const v = (override ?? values[key] ?? "").trim();
    if (!v) return;
    setTesting(key);
    const started = Date.now();
    let result: TestStatus;
    try {
      const { data, error } = await supabase.functions.invoke("test-integration", {
        body: { kind: key, value: v },
      });
      result = error
        ? { ok: false, error: error.message, testedAt: new Date().toISOString() }
        : { ok: !!data?.ok, error: data?.error, details: data?.details, testedAt: data?.testedAt || new Date().toISOString() };
    } catch (e) {
      result = {
        ok: false,
        error: describeError(e) || "Test request failed",
        testedAt: new Date().toISOString(),
      };
    }
    logDiagnostic({
      action,
      target: key,
      label: labelFor(key),
      ok: result.ok,
      error: result.error,
      details: result.details,
      durationMs: Date.now() - started,
    });
    setTests((prev) => {
      const next = { ...prev, [key]: result };
      saveTestCache(next);
      return next;
    });
    setTesting(null);
  };

  const [refreshingAll, setRefreshingAll] = useState(false);
  const refreshAll = async () => {
    const keys = FIELDS.map((f) => f.key).filter((k) => (original[k] || "").trim());
    if (!keys.length) return;
    setRefreshingAll(true);
    const started = Date.now();
    try {
      await Promise.all(keys.map((k) => runTest(k, original[k], "refresh").catch(() => {})));
      logDiagnostic({
        action: "refresh",
        label: `${keys.length} ${keys.length === 1 ? "integration" : "integrations"}`,
        ok: true,
        durationMs: Date.now() - started,
      });
    } catch (e) {
      logDiagnostic({
        action: "refresh",
        label: "Refresh all",
        ok: false,
        error: describeError(e),
        durationMs: Date.now() - started,
      });
    } finally {
      setRefreshingAll(false);
    }
  };



  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" size={24} /></div>;

  return (
    <div className="space-y-4">
      <DashboardCard>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-medium text-foreground">Integrations / Интеграции</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Paste your Google Workspace tracking IDs and SEO codes. They go live on the public site immediately after saving.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={refreshAll}
              disabled={refreshingAll || !Object.values(original).some((v) => v?.trim())}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-foreground hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
              title={docLang === "en" ? "Re-test every saved integration" : "Перепроверить все сохранённые интеграции"}
            >
              {refreshingAll ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              {docLang === "en" ? "Refresh all" : "Обновить все"}
            </button>
            <div className="flex items-center gap-1 bg-secondary p-0.5 rounded-lg">
              <Languages size={13} className="text-muted-foreground mx-1.5" />
              {(["en", "ru"] as DocLang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setDocLang(l)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    docLang === l ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </DashboardCard>

      {FIELDS.map((f) => {
        const value = values[f.key] || "";
        const isConnected = !!original[f.key]?.trim();
        const dirty = value !== (original[f.key] || "");
        const valid = !f.validate || f.validate(value);
        const isSecret = !!f.secret;
        const showSecret = reveal[f.key];
        const test = tests[f.key];
        const isTesting = testing === f.key;

        return (
          <DashboardCard key={f.key}>
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  {isConnected ? (
                    <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                  ) : (
                    <Circle size={16} className="text-muted-foreground/40 shrink-0" />
                  )}
                  <h4 className="text-sm font-medium text-foreground">{f.label}</h4>
                  {isConnected && (
                    <span className="text-[10px] px-2 py-0.5 bg-green-500/10 text-green-600 rounded-full">Connected</span>
                  )}
                  {f.key === "integration_ga4_id" && connectorGa4Id && (
                    <span className="text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-600 rounded-full">Connector</span>
                  )}
                  {isConnected && f.key.endsWith("_verification") && test && (
                    test.ok ? (
                      <span className="text-[10px] px-2 py-0.5 bg-green-500/15 text-green-700 dark:text-green-400 rounded-full">
                        {docLang === "en" ? "Confirmed live" : "Подтверждено"}
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 bg-destructive/10 text-destructive rounded-full">
                        {docLang === "en" ? "Not confirmed" : "Не подтверждено"}
                      </span>
                    )
                  )}
                </div>
                <a
                  href={f.docs.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink size={11} /> {f.docs.label}
                </a>
              </div>

              <div className="rounded-lg bg-secondary/40 border border-border p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                  {docLang === "en" ? "How to get this" : "Как получить"}
                </p>
                <ol className="space-y-1.5 text-xs text-foreground list-decimal pl-4 leading-relaxed">
                  {f.instructions[docLang].map((step, i) => (<li key={i}>{step}</li>))}
                </ol>
              </div>

              <div className="flex flex-wrap gap-2 items-stretch">
                <div className="relative flex-1 min-w-[12rem] basis-full sm:basis-0">
                  <input
                    type={isSecret && !showSecret ? "password" : "text"}
                    value={value}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    spellCheck={false}
                    disabled={f.key === "integration_ga4_id" && !!connectorGa4Id}
                    title={f.key === "integration_ga4_id" && connectorGa4Id
                      ? (docLang === "en" ? "Managed by the Google Analytics connector" : "Управляется коннектором Google Analytics")
                      : undefined}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground font-mono ${
                      valid ? "border-border" : "border-destructive"
                    } ${isSecret ? "pr-10" : ""} ${f.key === "integration_ga4_id" && connectorGa4Id ? "opacity-60 cursor-not-allowed" : ""}`}
                  />
                  {isSecret && (
                    <button
                      type="button"
                      onClick={() => setReveal({ ...reveal, [f.key]: !showSecret })}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => save(f.key)}
                  disabled={!dirty || !valid || savingKey === f.key || (f.key === "integration_ga4_id" && !!connectorGa4Id)}
                  title={f.key === "integration_ga4_id" && connectorGa4Id
                    ? (docLang === "en" ? "Managed by the Google Analytics connector" : "Управляется коннектором Google Analytics")
                    : undefined}
                  className="flex items-center gap-2 px-4 py-2 bg-foreground text-background text-sm rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {savingKey === f.key ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {docLang === "en" ? "Save" : "Сохранить"}
                </button>
                <button
                  onClick={() => runTest(f.key)}
                  disabled={!value.trim() || !valid || isTesting || dirty}
                  title={dirty ? (docLang === "en" ? "Save first, then test" : "Сначала сохраните, затем тест") : ""}
                  className="flex items-center gap-2 px-3 py-2 border border-border text-foreground text-sm rounded-lg hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isTesting ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
                  {docLang === "en" ? "Test" : "Тест"}
                </button>
              </div>
              {test && (
                <div className={`flex items-start gap-2 text-[11px] rounded-md px-2.5 py-2 border ${
                  test.ok ? "border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-400"
                          : "border-destructive/40 bg-destructive/5 text-destructive"
                }`}>
                  {test.ok ? <CheckCircle2 size={12} className="mt-0.5 shrink-0" /> : <AlertCircle size={12} className="mt-0.5 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">
                        {test.ok
                          ? (docLang === "en" ? "Live & responding" : "Активно и отвечает")
                          : (docLang === "en" ? "Check failed" : "Ошибка проверки")}
                      </span>
                      <span className="text-muted-foreground">· {docLang === "en" ? "tested" : "проверено"} {formatRelative(test.testedAt, docLang)}</span>
                    </div>
                    {(test.error || test.details) && (
                      <p className="mt-0.5 break-words opacity-90">{test.error || test.details}</p>
                    )}
                  </div>
                </div>
              )}
              {!valid && (
                <p className="text-[11px] text-destructive">
                  {docLang === "en"
                    ? `Format looks wrong — expected ${f.placeholder.split(" ")[0]}`
                    : `Неверный формат — ожидается ${f.placeholder.split(" ")[0]}`}
                </p>
              )}
            </div>
          </DashboardCard>
        );
      })}

      <IntegrationDiagnostics lang={docLang} />
    </div>
  );
};

export default DashboardIntegrations;
