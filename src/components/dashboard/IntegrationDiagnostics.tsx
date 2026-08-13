import { useEffect, useState } from "react";
import { Activity, ChevronDown, ChevronUp, Trash2, CheckCircle2, XCircle, Copy, RotateCw, Loader2 } from "lucide-react";
import DashboardCard from "./DashboardCard";
import {
  DiagEntry,
  clearDiagnostics,
  readDiagnostics,
  subscribeDiagnostics,
} from "@/lib/integration-diagnostics";

const ACTION_LABEL: Record<string, { en: string; ru: string }> = {
  save: { en: "Save", ru: "Сохранение" },
  test: { en: "Test", ru: "Проверка" },
  refresh: { en: "Refresh all", ru: "Обновить все" },
  load: { en: "Load settings", ru: "Загрузка настроек" },
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

interface Props {
  lang: "en" | "ru";
  /** Re-runs the request behind a failed entry. */
  onRetry?: (entry: DiagEntry) => Promise<void> | void;
}

const IntegrationDiagnostics = ({ lang, onRetry }: Props) => {
  const [entries, setEntries] = useState<DiagEntry[]>(readDiagnostics);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const retry = async (entry: DiagEntry) => {
    if (!onRetry) return;
    setRetryingId(entry.id);
    try {
      await onRetry(entry);
    } finally {
      setRetryingId(null);
    }
  };

  useEffect(() => subscribeDiagnostics(setEntries), []);

  const failures = entries.filter((e) => !e.ok).length;
  const last = entries[0];

  const copyAll = async () => {
    const text = entries
      .map(
        (e) =>
          `${e.at} [${e.action}] ${e.label} — ${e.ok ? "OK" : "FAIL"} (${e.durationMs}ms)` +
          (e.error ? `\n    error: ${e.error}` : "") +
          (e.details ? `\n    details: ${e.details}` : ""),
      )
      .join("\n");
    try {
      await navigator.clipboard.writeText(text || "(empty)");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <DashboardCard>
      <div className="space-y-3">
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-3 text-left"
          aria-expanded={open}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Activity size={16} className="text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <h4 className="text-sm font-medium text-foreground">
                {lang === "en" ? "Diagnostics" : "Диагностика"}
              </h4>
              <p className="text-xs text-muted-foreground truncate">
                {last
                  ? `${fmtTime(last.at)} · ${ACTION_LABEL[last.action]?.[lang] || last.action} · ${last.label} · ${
                      last.ok ? "OK" : lang === "en" ? "failed" : "ошибка"
                    }`
                  : lang === "en"
                    ? "No requests recorded yet in this browser."
                    : "Пока нет записанных запросов в этом браузере."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {failures > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-destructive/10 text-destructive">
                {failures} {lang === "en" ? "failed" : "ошибок"}
              </span>
            )}
            <span className="text-xs text-muted-foreground">{entries.length}</span>
            {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </div>
        </button>

        {open && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={copyAll}
                disabled={!entries.length}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border border-border rounded-lg text-foreground hover:bg-secondary disabled:opacity-40"
              >
                <Copy size={12} />
                {copied ? (lang === "en" ? "Copied" : "Скопировано") : lang === "en" ? "Copy log" : "Копировать лог"}
              </button>
              <button
                onClick={clearDiagnostics}
                disabled={!entries.length}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:bg-secondary disabled:opacity-40"
              >
                <Trash2 size={12} />
                {lang === "en" ? "Clear" : "Очистить"}
              </button>
            </div>

            {entries.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {lang === "en"
                  ? "Run Save, Test or Refresh all above and the request result will appear here."
                  : "Нажмите Save, Test или «Обновить все» выше — результат запроса появится здесь."}
              </p>
            ) : (
              <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                {entries.map((e) => (
                  <li key={e.id} className="p-2.5 text-xs bg-background">
                    <div className="flex items-start gap-2 flex-wrap">
                      {e.ok ? (
                        <CheckCircle2 size={14} className="text-green-500 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle size={14} className="text-destructive shrink-0 mt-0.5" />
                      )}
                      <span className="font-medium text-foreground">
                        {ACTION_LABEL[e.action]?.[lang] || e.action}
                      </span>
                      <span className="text-muted-foreground truncate">{e.label}</span>
                      <span className="ml-auto text-muted-foreground tabular-nums whitespace-nowrap">
                        {fmtTime(e.at)} · {e.durationMs}ms
                      </span>
                    </div>
                    {!e.ok && onRetry && (
                      <div className="mt-1.5 pl-6">
                        <button
                          onClick={() => retry(e)}
                          disabled={retryingId === e.id}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium border border-border rounded-md text-foreground hover:bg-secondary disabled:opacity-40"
                        >
                          {retryingId === e.id ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : (
                            <RotateCw size={11} />
                          )}
                          {lang === "en" ? "Retry" : "Повторить"}
                        </button>
                      </div>
                    )}
                    {(e.error || e.details) && (
                      <div className="mt-1.5 pl-6 space-y-0.5">
                        {e.error && <p className="text-destructive break-words">{e.error}</p>}
                        {e.details && <p className="text-muted-foreground break-words">{e.details}</p>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-muted-foreground">
              {lang === "en"
                ? "Stored locally in this browser only (last 40 requests)."
                : "Хранится только в этом браузере (последние 40 запросов)."}
            </p>
          </div>
        )}
      </div>
    </DashboardCard>
  );
};

export default IntegrationDiagnostics;
