/**
 * Lightweight client-side diagnostics log for the Integrations dashboard.
 * Records every Save / Test / Refresh request so live issues can be
 * troubleshooted without opening the browser devtools.
 */

export type DiagAction = "save" | "test" | "refresh" | "load";

export interface DiagEntry {
  id: string;
  action: DiagAction;
  /** content_key of the integration field, when applicable */
  target?: string;
  /** human label of the field / operation */
  label: string;
  ok: boolean;
  /** short error message when ok === false */
  error?: string;
  /** extra detail returned by the edge function */
  details?: string;
  /** ms the request took */
  durationMs: number;
  at: string;
}

const KEY = "integration_diagnostics_v1";
const MAX = 40;

type Listener = (entries: DiagEntry[]) => void;
const listeners = new Set<Listener>();

export const readDiagnostics = (): DiagEntry[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? (raw as DiagEntry[]) : [];
  } catch {
    return [];
  }
};

const write = (entries: DiagEntry[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX)));
  } catch {
    /* quota / private mode — diagnostics are best-effort */
  }
  listeners.forEach((l) => l(entries.slice(0, MAX)));
};

export const logDiagnostic = (entry: Omit<DiagEntry, "id" | "at">) => {
  const full: DiagEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
  };
  write([full, ...readDiagnostics()]);
  return full;
};

export const clearDiagnostics = () => write([]);

export const subscribeDiagnostics = (fn: Listener) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

/** Normalise anything thrown into a readable one-liner. */
export const describeError = (e: unknown): string => {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  const anyE = e as { message?: string; error?: string };
  return anyE.message || anyE.error || JSON.stringify(e).slice(0, 200);
};
