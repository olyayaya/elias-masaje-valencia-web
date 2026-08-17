import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, MessageCircle, Trash2, Download, Check, PhoneOff } from "lucide-react";
import DashboardCard from "./DashboardCard";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n/context";
import { leadWhatsAppUrl } from "@/lib/phone";
import { toast } from "sonner";


type Lead = {
  id: string;
  name: string;
  phone: string;
  preferred_time: string;
  service: string;
  duration: string | null;
  price: string | null;
  message: string;
  location: string | null;
  page_path: string | null;
  locale: string | null;
  status: string;
  created_at: string;
};

const COPY = {
  title: { en: "Booking leads", es: "Solicitudes de reserva", ru: "Заявки на запись" },
  subtitle: {
    en: "Every WhatsApp booking request is saved here with the selected service, duration, price and message.",
    es: "Cada solicitud de reserva por WhatsApp se guarda aquí con el servicio, la duración, el precio y el mensaje.",
    ru: "Каждая заявка через WhatsApp сохраняется здесь с услугой, длительностью, ценой и сообщением.",
  },
  empty: { en: "No booking requests yet.", es: "Aún no hay solicitudes.", ru: "Заявок пока нет." },
  refresh: { en: "Refresh", es: "Actualizar", ru: "Обновить" },
  exportCsv: { en: "Export CSV", es: "Exportar CSV", ru: "Экспорт CSV" },
  contact: { en: "WhatsApp", es: "WhatsApp", ru: "WhatsApp" },
  markDone: { en: "Mark handled", es: "Marcar atendida", ru: "Обработана" },
  handled: { en: "Handled", es: "Atendida", ru: "Обработана" },
  newLabel: { en: "New", es: "Nueva", ru: "Новая" },
  del: { en: "Delete", es: "Eliminar", ru: "Удалить" },
  deleted: { en: "Lead deleted", es: "Solicitud eliminada", ru: "Заявка удалена" },
  loadError: { en: "Couldn't load leads", es: "No se pudieron cargar las solicitudes", ru: "Не удалось загрузить заявки" },
  total: { en: "Total", es: "Total", ru: "Всего" },
  pending: { en: "Pending", es: "Pendientes", ru: "В ожидании" },
  noPhone: { en: "No valid phone", es: "Teléfono no válido", ru: "Некорректный номер" },
} as const;


const DashboardLeads = () => {
  const { locale } = useI18n();
  const L = (k: keyof typeof COPY) => COPY[k][locale as "en" | "es" | "ru"] ?? COPY[k].en;

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("booking_leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) toast.error(L("loadError"));
    setLeads((data as Lead[]) || []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const pending = useMemo(() => leads.filter((l) => l.status !== "handled").length, [leads]);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("booking_leads").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("booking_leads").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setLeads((prev) => prev.filter((l) => l.id !== id));
    toast.success(L("deleted"));
  };

  const exportCsv = () => {
    const head = ["created_at", "name", "phone", "preferred_time", "service", "duration", "price", "locale", "location", "page_path", "status", "message"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [head.join(","), ...leads.map((l) => head.map((h) => esc((l as any)[h])).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `booking-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl">{L("title")}</h2>
          <p className="text-sm text-muted-foreground font-body mt-1 max-w-2xl">{L("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="inline-flex items-center gap-2 text-sm border border-border rounded-lg px-3 py-2 hover:bg-secondary transition-colors">
            <Download size={14} /> {L("exportCsv")}
          </button>
          <button onClick={() => void load()} className="inline-flex items-center gap-2 text-sm border border-border rounded-lg px-3 py-2 hover:bg-secondary transition-colors">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> {L("refresh")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-md">
        <DashboardCard>
          <p className="text-xs text-muted-foreground">{L("total")}</p>
          <p className="font-display text-3xl">{leads.length}</p>
        </DashboardCard>
        <DashboardCard>
          <p className="text-xs text-muted-foreground">{L("pending")}</p>
          <p className="font-display text-3xl">{pending}</p>
        </DashboardCard>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : leads.length === 0 ? (
        <p className="text-sm text-muted-foreground font-body py-8">{L("empty")}</p>
      ) : (
        <div className="space-y-3">
          {leads.map((l) => {
            const reply = [
              `Hola ${l.name}, soy Elias (Elias Masaje).`,
              "",
              `Sobre tu solicitud: ${[l.service, l.duration, l.price].filter(Boolean).join(" · ")}`,
              `Horario preferido: ${l.preferred_time}`,
            ].join("\n");
            const waHref = leadWhatsAppUrl(l.phone, reply);
            return (
            <DashboardCard key={l.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display text-lg">{l.name}</span>
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${l.status === "handled" ? "bg-secondary text-muted-foreground" : "bg-primary/15 text-primary-strong"}`}>
                      {l.status === "handled" ? L("handled") : L("newLabel")}
                    </span>
                    {l.locale && <span className="text-[10px] uppercase text-muted-foreground">{l.locale}</span>}
                  </div>
                  <p className="text-sm text-muted-foreground font-body mt-1">
                    {l.service}
                    {l.duration ? ` · ${l.duration}` : ""}
                    {l.price ? ` · ${l.price}` : ""}
                  </p>
                  <p className="text-sm font-body mt-1">{l.phone} · {l.preferred_time}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(l.created_at).toLocaleString()}{l.location ? ` · ${l.location}` : ""}{l.page_path ? ` · ${l.page_path}` : ""}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {waHref ? (
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs border border-border rounded-lg px-3 py-2 hover:bg-secondary transition-colors"
                    >
                      <MessageCircle size={13} /> {L("contact")}
                    </a>
                  ) : (
                    <span
                      title={L("noPhone")}
                      className="inline-flex items-center gap-1.5 text-xs border border-border rounded-lg px-3 py-2 text-muted-foreground opacity-60 cursor-not-allowed"
                    >
                      <PhoneOff size={13} /> {L("noPhone")}
                    </span>
                  )}

                  {l.status !== "handled" && (
                    <button onClick={() => void setStatus(l.id, "handled")} className="inline-flex items-center gap-1.5 text-xs border border-border rounded-lg px-3 py-2 hover:bg-secondary transition-colors">
                      <Check size={13} /> {L("markDone")}
                    </button>
                  )}
                  <button onClick={() => void remove(l.id)} aria-label={L("del")} className="inline-flex items-center text-xs border border-border rounded-lg px-3 py-2 hover:bg-destructive/10 hover:text-destructive transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <details className="mt-3">
                <summary className="text-xs text-muted-foreground cursor-pointer">{l.message.slice(0, 60)}…</summary>
                <pre className="mt-2 whitespace-pre-wrap text-xs font-body bg-secondary/50 rounded-lg p-3">{l.message}</pre>
              </details>
            </DashboardCard>
            );
          })}

        </div>
      )}
    </div>
  );
};

export default DashboardLeads;
