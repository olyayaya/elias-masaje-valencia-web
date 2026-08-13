import { useEffect, useState } from "react";
import { Eye, Users, MessageCircle, Inbox, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n/context";

const COPY = {
  views: { en: "Page views", es: "Páginas vistas", ru: "Просмотры" },
  visits: { en: "Visits", es: "Visitas", ru: "Визиты" },
  whatsapp: { en: "WhatsApp clicks", es: "Clics de WhatsApp", ru: "Клики WhatsApp" },
  leads: { en: "Booking leads", es: "Solicitudes", ru: "Заявки" },
  last: { en: "Last {d} days", es: "Últimos {d} días", ru: "За {d} дн." },
};

/** Compact real-traffic cards for the dashboard overview (first-party data). */
const TrafficStatCards = ({ days = 30 }: { days?: number }) => {
  const { locale } = useI18n();
  const lang: "en" | "es" | "ru" = locale === "ru" ? "ru" : locale === "es" ? "es" : "en";
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ views: 0, visits: 0, whatsapp: 0, leads: 0 });

  useEffect(() => {
    const since = new Date(Date.now() - days * 864e5).toISOString();
    (async () => {
      const [{ data: events }, { count: leads }] = await Promise.all([
        supabase
          .from("conversion_events")
          .select("event_name, metadata")
          .gte("created_at", since)
          .limit(5000),
        supabase
          .from("booking_leads")
          .select("id", { count: "exact", head: true })
          .gte("created_at", since),
      ]);
      const visits = new Set<string>();
      let views = 0;
      let whatsapp = 0;
      (events || []).forEach((e: any) => {
        if (e.event_name === "page_view") {
          views += 1;
          const v = (e.metadata || {}).visit;
          if (v) visits.add(v);
        }
        if (e.event_name === "whatsapp_click") whatsapp += 1;
      });
      setStats({ views, visits: visits.size, whatsapp, leads: leads || 0 });
      setLoading(false);
    })();
  }, [days]);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border bg-card p-8">
        <Loader2 className="animate-spin text-muted-foreground" size={20} />
      </div>
    );
  }

  const sub = COPY.last[lang].replace("{d}", String(days));
  const cards = [
    { label: COPY.views[lang], value: stats.views, icon: Eye },
    { label: COPY.visits[lang], value: stats.visits, icon: Users },
    { label: COPY.whatsapp[lang], value: stats.whatsapp, icon: MessageCircle },
    { label: COPY.leads[lang], value: stats.leads, icon: Inbox },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <c.icon size={14} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{c.label}</span>
          </div>
          <p className="text-xl font-semibold text-foreground">{c.value.toLocaleString(locale)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
        </div>
      ))}
    </div>
  );
};

export default TrafficStatCards;
