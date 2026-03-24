import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardCard from "./DashboardCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Loader2, Sparkles, Clock, Tag } from "lucide-react";
import { toast } from "sonner";
import { format, addDays, isAfter, isBefore } from "date-fns";

interface Service {
  id: string;
  title: string;
}

interface Promotion {
  id: string;
  service_id: string;
  badge_text: string;
  badge_text_en: string;
  badge_text_ru: string;
  badge_color: string;
  starts_at: string;
  ends_at: string;
  active: boolean;
  created_at: string;
}

interface AiSuggestion {
  text: string;
  text_en: string;
  text_ru: string;
  suggested_days: number;
}

const BADGE_COLORS = [
  { id: "amber", label: "Gold", classes: "bg-amber-100 text-amber-800 border-amber-200" },
  { id: "rose", label: "Rose", classes: "bg-rose-100 text-rose-800 border-rose-200" },
  { id: "emerald", label: "Green", classes: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { id: "blue", label: "Blue", classes: "bg-blue-100 text-blue-800 border-blue-200" },
  { id: "purple", label: "Purple", classes: "bg-purple-100 text-purple-800 border-purple-200" },
];

const colorClasses = (colorId: string) =>
  BADGE_COLORS.find((c) => c.id === colorId)?.classes ?? BADGE_COLORS[0].classes;

const DURATION_OPTIONS = [
  { value: "7", label: "7 days" },
  { value: "10", label: "10 days" },
  { value: "14", label: "2 weeks" },
  { value: "21", label: "3 weeks" },
  { value: "30", label: "1 month" },
  { value: "60", label: "2 months" },
];

const DashboardPromotions = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);

  // Form state
  const [selectedService, setSelectedService] = useState("");
  const [badgeText, setBadgeText] = useState("");
  const [badgeTextEn, setBadgeTextEn] = useState("");
  const [badgeTextRu, setBadgeTextRu] = useState("");
  const [badgeColor, setBadgeColor] = useState("amber");
  const [duration, setDuration] = useState("14");

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: sData }, { data: pData }] = await Promise.all([
      supabase.from("services").select("id, title").order("sort_order"),
      supabase.from("promotions").select("*").order("created_at", { ascending: false }),
    ]);
    if (sData) setServices(sData);
    if (pData) setPromotions(pData as Promotion[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const getServiceName = (id: string) => services.find((s) => s.id === id)?.title ?? "Unknown";

  const isActive = (p: Promotion) => {
    const now = new Date();
    return p.active && isBefore(new Date(p.starts_at), now) && isAfter(new Date(p.ends_at), now);
  };

  const suggestBadges = async () => {
    setSuggestLoading(true);
    try {
      const serviceNames = services.map((s) => s.title).join(", ");
      const { data, error } = await supabase.functions.invoke("ai-content-helper", {
        body: { text: serviceNames, action: "suggest_badges" },
      });
      if (error) throw error;
      // Parse the result — strip markdown code fences if present
      let raw = data?.result;
      if (typeof raw === "string") {
        raw = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      }
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) {
        setSuggestions(parsed);
        toast.success("Badge ideas ready — pick one or write your own");
      }
    } catch {
      toast.error("Failed to get suggestions");
    }
    setSuggestLoading(false);
  };

  const applySuggestion = (s: AiSuggestion) => {
    setBadgeText(s.text);
    setBadgeTextEn(s.text_en);
    setBadgeTextRu(s.text_ru);
    setDuration(String(s.suggested_days));
    setSuggestions([]);
    toast.info("Applied — adjust and save");
  };

  const savePromotion = async () => {
    if (!selectedService || !badgeText.trim()) {
      toast.error("Pick a service and enter badge text");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("promotions").insert({
      service_id: selectedService,
      badge_text: badgeText.trim(),
      badge_text_en: badgeTextEn.trim(),
      badge_text_ru: badgeTextRu.trim(),
      badge_color: badgeColor,
      starts_at: new Date().toISOString(),
      ends_at: addDays(new Date(), parseInt(duration)).toISOString(),
    });
    if (error) {
      toast.error("Failed to save promotion");
    } else {
      toast.success("Promotion created!");
      resetForm();
      fetchAll();
    }
    setSaving(false);
  };

  const deletePromo = async (id: string) => {
    await supabase.from("promotions").delete().eq("id", id);
    toast.success("Promotion removed");
    fetchAll();
  };

  const toggleActive = async (p: Promotion) => {
    await supabase.from("promotions").update({ active: !p.active }).eq("id", p.id);
    fetchAll();
  };

  const resetForm = () => {
    setShowForm(false);
    setSelectedService("");
    setBadgeText("");
    setBadgeTextEn("");
    setBadgeTextRu("");
    setBadgeColor("amber");
    setDuration("14");
    setSuggestions([]);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  const activePromos = promotions.filter(isActive);
  const expiredPromos = promotions.filter((p) => !isActive(p));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">
          {activePromos.length} active promotion{activePromos.length !== 1 ? "s" : ""}
        </p>
        <Button onClick={() => setShowForm(true)} className="gap-2" disabled={showForm}>
          <Plus size={14} /> Add promotion
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <DashboardCard title="New Promotion" description="Add a badge to a service">
          <div className="space-y-4">
            {/* AI Suggestions */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={suggestBadges} disabled={suggestLoading} className="gap-2">
                {suggestLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Suggest badge ideas with AI
              </Button>
            </div>

            {suggestions.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => applySuggestion(s)}
                    className="text-left p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-colors"
                  >
                    <span className="text-sm font-medium">{s.text}</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      EN: {s.text_en} · RU: {s.text_ru}
                    </span>
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      Suggested: {s.suggested_days} days
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Service picker */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Service</label>
              <Select value={selectedService} onValueChange={setSelectedService}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pick a service" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Badge text */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Badge (ES)</label>
                <Input value={badgeText} onChange={(e) => setBadgeText(e.target.value)} placeholder="Más popular" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Badge (EN)</label>
                <Input value={badgeTextEn} onChange={(e) => setBadgeTextEn(e.target.value)} placeholder="Most popular" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Badge (RU)</label>
                <Input value={badgeTextRu} onChange={(e) => setBadgeTextRu(e.target.value)} placeholder="Самый популярный" />
              </div>
            </div>

            {/* Color + Duration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Badge color</label>
                <div className="flex gap-2">
                  {BADGE_COLORS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setBadgeColor(c.id)}
                      className={`px-3 py-1.5 text-xs rounded-full border transition-all ${c.classes} ${badgeColor === c.id ? "ring-2 ring-offset-1 ring-foreground/20" : "opacity-60 hover:opacity-100"}`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Duration</label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Live preview */}
            {badgeText && (
              <div className="pt-2">
                <label className="text-xs font-medium text-muted-foreground mb-3 block">Preview — how it looks on the site</label>
                <div className="border border-border rounded-lg p-5 bg-background">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="font-semibold text-sm text-foreground">
                      {selectedService ? getServiceName(selectedService) : "Service Name"}
                    </span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${colorClasses(badgeColor)}`}>
                      {badgeText}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">Service description text will appear here…</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>60 min</span>
                    <span className="w-px h-3 bg-border" />
                    <span className="font-medium text-foreground">50 €</span>
                  </div>
                  {(badgeTextEn || badgeTextRu) && (
                    <div className="mt-3 pt-3 border-t border-border flex gap-3 flex-wrap">
                      {badgeTextEn && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground">EN:</span>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${colorClasses(badgeColor)}`}>
                            {badgeTextEn}
                          </span>
                        </div>
                      )}
                      {badgeTextRu && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground">RU:</span>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${colorClasses(badgeColor)}`}>
                            {badgeTextRu}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Active for {duration} days from today
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" size="sm" onClick={resetForm}>Cancel</Button>
              <Button size="sm" onClick={savePromotion} disabled={saving} className="gap-2">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Tag size={14} />}
                Create promotion
              </Button>
            </div>
          </div>
        </DashboardCard>
      )}

      {/* Active promotions */}
      {activePromos.length > 0 && (
        <DashboardCard title="Active" description="Currently showing on the site">
          <div className="space-y-3">
            {activePromos.map((p) => (
              <PromoRow key={p.id} promo={p} serviceName={getServiceName(p.service_id)} onDelete={deletePromo} onToggle={toggleActive} />
            ))}
          </div>
        </DashboardCard>
      )}

      {/* Expired / inactive */}
      {expiredPromos.length > 0 && (
        <DashboardCard title="Expired / Inactive" description="Past or paused promotions">
          <div className="space-y-3">
            {expiredPromos.map((p) => (
              <PromoRow key={p.id} promo={p} serviceName={getServiceName(p.service_id)} onDelete={deletePromo} onToggle={toggleActive} expired />
            ))}
          </div>
        </DashboardCard>
      )}

      {promotions.length === 0 && !showForm && (
        <DashboardCard>
          <div className="text-center py-8">
            <Tag size={24} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-1">No promotions yet</p>
            <p className="text-xs text-muted-foreground">Add a badge like "Most popular" or "10% off this week" to highlight services</p>
          </div>
        </DashboardCard>
      )}
    </div>
  );
};

const PromoRow = ({ promo, serviceName, onDelete, onToggle, expired }: {
  promo: Promotion;
  serviceName: string;
  onDelete: (id: string) => void;
  onToggle: (p: Promotion) => void;
  expired?: boolean;
}) => {
  const endsAt = new Date(promo.ends_at);
  const daysLeft = Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 py-2 ${expired ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border whitespace-nowrap ${colorClasses(promo.badge_color)}`}>
          {promo.badge_text}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{serviceName}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock size={10} />
            {expired
              ? `Ended ${format(endsAt, "MMM d")}`
              : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left · ends ${format(endsAt, "MMM d")}`}
          </p>
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <Button variant="ghost" size="sm" onClick={() => onToggle(promo)} className="text-xs h-8">
          {promo.active ? "Pause" : "Resume"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onDelete(promo.id)} className="text-destructive hover:text-destructive h-8">
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  );
};

export default DashboardPromotions;
