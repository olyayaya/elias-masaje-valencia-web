import * as Sentry from "@sentry/react";

/**
 * Sentry error reporting.
 *
 * The DSN is stored like every other integration: in site_content
 * (content_key = "integration_sentry_dsn"), pasted from the dashboard.
 * It is additionally mirrored to localStorage so Sentry can boot on the very
 * first frame — before the database round-trip finishes — and therefore catch
 * blank-screen crashes that happen during initial render.
 */

const DSN_CACHE_KEY = "sentry_dsn_v1";
const DSN_RE = /^https:\/\/[^@/]+@[^/]+\/\d+$/;

let initialized = false;
let activeDsn: string | null = null;

export const isValidSentryDsn = (dsn: string) => DSN_RE.test(dsn.trim());

export const getCachedSentryDsn = (): string | null => {
  try {
    const v = localStorage.getItem(DSN_CACHE_KEY);
    return v && isValidSentryDsn(v) ? v : null;
  } catch {
    return null;
  }
};

export const cacheSentryDsn = (dsn: string | null) => {
  try {
    if (dsn && isValidSentryDsn(dsn)) localStorage.setItem(DSN_CACHE_KEY, dsn.trim());
    else localStorage.removeItem(DSN_CACHE_KEY);
  } catch {
    /* private mode — best effort */
  }
};

export const isSentryActive = () => initialized;

/** Boot Sentry once. Safe to call repeatedly. */
export const initSentry = (dsn: string | null | undefined) => {
  const clean = (dsn || "").trim();
  if (!clean || !isValidSentryDsn(clean)) return false;
  if (initialized) return activeDsn === clean;

  Sentry.init({
    dsn: clean,
    environment: window.location.hostname === "eliasmas.es" ? "production" : "preview",
    // Errors only — no session replay / performance sampling overhead.
    tracesSampleRate: 0,
    sendDefaultPii: false,
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications.",
      /^Non-Error promise rejection captured/,
    ],
    beforeSend(event) {
      event.tags = { ...event.tags, area: event.tags?.area ?? "app" };
      return event;
    },
  });

  initialized = true;
  activeDsn = clean;
  cacheSentryDsn(clean);
  return true;
};

/** Report a crash caught by a React error boundary (blank-screen case). */
export const reportCrash = (error: unknown, componentStack?: string) => {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    scope.setTag("area", "crash");
    scope.setLevel("fatal");
    if (componentStack) scope.setContext("react", { componentStack });
    Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
  });
};

/** Report a failed dashboard integration request (save / test / refresh / load). */
export const reportIntegrationFailure = (
  action: string,
  target: string | undefined,
  message: string,
  extra?: Record<string, unknown>,
) => {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    scope.setTag("area", "dashboard-integrations");
    scope.setTag("integration_action", action);
    if (target) scope.setTag("integration_target", target);
    scope.setLevel("error");
    if (extra) scope.setContext("integration", extra);
    Sentry.captureException(new Error(`[integrations:${action}${target ? `:${target}` : ""}] ${message}`));
  });
};

/** Breadcrumb so the trail leading to a failure is visible in the Sentry event. */
export const addIntegrationBreadcrumb = (message: string, data?: Record<string, unknown>) => {
  if (!initialized) return;
  Sentry.addBreadcrumb({ category: "integrations", message, data, level: "info" });
};
