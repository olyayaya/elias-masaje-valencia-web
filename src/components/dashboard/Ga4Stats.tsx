import { Eye, Users, MousePointerClick, Clock, Loader2, BarChart3 } from "lucide-react";
import { useI18n } from "@/i18n/context";
import { useDashboardT } from "@/i18n/dashboard";
import { useGa4 } from "@/hooks/use-ga4";

const fmtNumber = (n: number, locale: string) => n.toLocaleString(locale);

const fmtDuration = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m > 0 ? `${m}m ${rem}s` : `${rem}s`;
};

/**
 * Real Google Analytics 4 stat cards (page views / visitors / sessions / avg
 * session) for a rolling window. Shows a "connect GA" notice when GA4 isn't set
 * up, a spinner while loading, and an error note if the Data API call fails —
 * never invented numbers.
 */
const Ga4Stats = ({ days = 30 }: { days?: number }) => {
  const { locale } = useI18n();
  const dt = useDashboardT(locale);
  const g = dt.ga4;
  const { data, isLoading } = useGa4(days);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border bg-card p-8">
        <Loader2 className="animate-spin text-muted-foreground" size={20} />
      </div>
    );
  }

  // Not set up yet, or the function isn't reachable (local dev) → connect notice.
  if (!data || !data.configured) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-secondary/40 p-5 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
          <BarChart3 size={16} className="text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{g.connectTitle}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{g.connectBody}</p>
        </div>
      </div>
    );
  }

  if (data.error || !data.totals) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-xs text-destructive">{g.loadError}</p>
      </div>
    );
  }

  const t = data.totals;
  const sub = g.last.replace("{days}", String(data.days ?? days));
  const cards = [
    { label: g.pageViews, value: fmtNumber(t.views, locale), icon: Eye },
    { label: g.visitors, value: fmtNumber(t.users, locale), icon: Users },
    { label: g.sessions, value: fmtNumber(t.sessions, locale), icon: MousePointerClick },
    { label: g.avgSession, value: fmtDuration(t.avgSessionDuration), icon: Clock },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <c.icon size={14} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{c.label}</span>
          </div>
          <p className="text-xl font-semibold text-foreground">{c.value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
        </div>
      ))}
    </div>
  );
};

export default Ga4Stats;
