import { IntegrationHealth, healthClasses, healthLabel, healthLevel } from "@/lib/integration-health";

interface Props {
  health?: IntegrationHealth;
  lang: "en" | "ru";
  /** Show the recent-outcome sparkline dots. */
  showHistory?: boolean;
}

/** Compact per-integration health chip: last result + failure count. */
const IntegrationHealthBadge = ({ health, lang, showHistory = true }: Props) => {
  const level = healthLevel(health);
  const label = healthLabel(level, lang);
  const failures = health?.failures ?? 0;

  const title = health
    ? lang === "en"
      ? `${health.checks} checks · ${failures} failed${health.streak ? ` · ${health.streak} in a row` : ""}${health.lastError ? ` · ${health.lastError}` : ""}`
      : `Проверок: ${health.checks} · Ошибок: ${failures}${health.streak ? ` · подряд: ${health.streak}` : ""}${health.lastError ? ` · ${health.lastError}` : ""}`
    : lang === "en"
      ? "No checks recorded yet"
      : "Проверок пока не было";

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full border ${healthClasses(level)}`}
    >
      <span className="font-medium">{label}</span>
      {failures > 0 && (
        <span className="opacity-80">
          {lang === "en" ? `· ${failures} fail${failures === 1 ? "" : "s"}` : `· ошибок: ${failures}`}
        </span>
      )}
      {showHistory && health && health.history.length > 0 && (
        <span className="flex items-center gap-0.5 ml-0.5" aria-hidden="true">
          {health.history.slice(-5).map((ok, i) => (
            <span
              key={i}
              className={`w-1 h-2.5 rounded-[1px] ${ok ? "bg-green-500/70" : "bg-destructive/70"}`}
            />
          ))}
        </span>
      )}
    </span>
  );
};

export default IntegrationHealthBadge;
