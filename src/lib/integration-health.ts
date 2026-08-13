/**
 * Per-integration health tracking (client-side, localStorage backed).
 * Records the outcome of every integration check so the dashboard can show
 * a scannable health indicator: last result, failure count and streaks.
 */

export interface IntegrationHealth {
  /** Total checks recorded. */
  checks: number;
  /** Total failed checks recorded. */
  failures: number;
  /** Failures since the last successful check. */
  streak: number;
  lastOkAt?: string;
  lastFailAt?: string;
  lastError?: string;
  /** Most recent outcomes, newest last (max 10). */
  history: boolean[];
}

export type HealthMap = Record<string, IntegrationHealth>;

const KEY = "integration_health_v1";
const MAX_HISTORY = 10;

const empty = (): IntegrationHealth => ({ checks: 0, failures: 0, streak: 0, history: [] });

export const loadHealth = (): HealthMap => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as HealthMap;
  } catch {
    return {};
  }
};

const persist = (map: HealthMap) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* storage full or unavailable — health is best-effort */
  }
};

/** Record a check outcome and return the updated map. */
export const recordHealth = (
  map: HealthMap,
  key: string,
  ok: boolean,
  error?: string,
  at: string = new Date().toISOString()
): HealthMap => {
  const prev = map[key] || empty();
  const next: IntegrationHealth = {
    checks: prev.checks + 1,
    failures: prev.failures + (ok ? 0 : 1),
    streak: ok ? 0 : prev.streak + 1,
    lastOkAt: ok ? at : prev.lastOkAt,
    lastFailAt: ok ? prev.lastFailAt : at,
    lastError: ok ? undefined : error || prev.lastError,
    history: [...prev.history, ok].slice(-MAX_HISTORY),
  };
  const updated = { ...map, [key]: next };
  persist(updated);
  return updated;
};

/** Forget a integration's history (e.g. the value was cleared). */
export const clearHealth = (map: HealthMap, key: string): HealthMap => {
  const updated = { ...map };
  delete updated[key];
  persist(updated);
  return updated;
};

export type HealthLevel = "healthy" | "degraded" | "failing" | "unknown";

export const healthLevel = (h?: IntegrationHealth): HealthLevel => {
  if (!h || h.checks === 0) return "unknown";
  if (h.streak >= 3) return "failing";
  if (h.streak > 0) return "degraded";
  // Recovered but with a shaky recent history
  const recent = h.history.slice(-5);
  if (recent.length >= 3 && recent.filter((v) => !v).length >= 2) return "degraded";
  return "healthy";
};

export const healthLabel = (level: HealthLevel, lang: "en" | "ru"): string => {
  const map: Record<HealthLevel, [string, string]> = {
    healthy: ["Healthy", "Стабильно"],
    degraded: ["Degraded", "Нестабильно"],
    failing: ["Failing", "Сбой"],
    unknown: ["Not checked", "Не проверено"],
  };
  return map[level][lang === "en" ? 0 : 1];
};

export const healthClasses = (level: HealthLevel): string => {
  switch (level) {
    case "healthy":
      return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30";
    case "degraded":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30";
    case "failing":
      return "bg-destructive/10 text-destructive border-destructive/40";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};
