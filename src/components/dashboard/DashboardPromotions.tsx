import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import DashboardCard from "./DashboardCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Loader2, Sparkles, Clock, Tag, Pencil } from "lucide-react";
import { toast } from "sonner";
import { format, addDays, isAfter, isBefore, differenceInDays } from "date-fns";
import { useI18n } from "@/i18n/context";
import { useDashboardT } from "@/i18n/dashboard";
import { AI_ENABLED } from "@/config/features";

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

const BADGE_COLORS_IDS = ["amber", "rose", "emerald", "blue", "purple"] as const;

const colorClasses = (colorId: string) => {
  const map: Record<string, string> = {
    amber: "bg-amber-100 text-amber-800 border-amber-200",
    rose: "bg-rose-100 text-rose-800 border-rose-200",
    emerald: "bg-emerald-100 text-emerald-800 border-emerald-200",
    blue: "bg-blue-100 text-blue-800 border-blue-200",
    purple: "bg-purple-100 text-purple-800 border-purple-200",
  };
  return map[colorId] ?? map.amber;
};

const DashboardPromotions = () => {
  const { locale } = useI18n();
  const dt = useDashboardT(locale);
  const pt = dt.promotions;

  const BADGE_COLORS = [
    { id: "amber", label: pt.gold, classes: "bg-amber-100 text-amber-800 border-amber-200" },
    { id: "rose", label: pt.rose, classes: "bg-rose-100 text-rose-800 border-rose-200" },
    { id: "emerald", label: pt.green, classes: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    { id: "blue", label: pt.blue, classes: "bg-blue-100 text-blue-800 border-blue-200" },
    { id: "purple", label: pt.purple, classes: "bg-purple-100 text-purple-800 border-purple-200" },
  ];

  const DURATION_OPTIONS = [
    { value: "7", label: pt.days7 },
    { value: "10", label: pt.days10 },
    { value: "14", label: pt.weeks2 },
    { value: "21", label: pt.weeks3 },
    { value: "30", label: pt.month1 },
    { value: "60", label: pt.months2 },
    { value: "90", label: pt.months3 },
  ];

  const [services, setServices] = useState<Service[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);

  // Form state
  const [selectedService, setSelectedService] = useState("");
  const [badgeText, setBadgeText] = useState("");
  const [badgeTextEn, setBadgeTextEn] = useState("");
  const [badgeTextRu, setBadgeTextRu] = useState("");
  const [badgeColor, setBadgeColor] = useState("amber");
  const [duration, setDuration] = useState("14");
  const queryClient = useQueryClient();

  const invalidatePublic = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.promotions });

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
    if (!AI_ENABLED) return;
    setSuggestLoading(true);
    try {
      const serviceNames = services.map((s) => s.title).join(", ");
      const { data, error } = await supabase.functions.invoke("ai-content-helper", {
        body: { text: serviceNames, action: "suggest_badges" },
      });
      if (error) throw error;
      let raw = data?.result;
      if (typeof raw === "string") {
        raw = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      }
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) {
        setSuggestions(parsed);
        toast.success(pt.badgeIdeasReady);
      }
    } catch {
      toast.error(pt.failedSuggestions);
    }
    setSuggestLoading(false);
  };

  const applySuggestion = (s: AiSuggestion) => {
    setBadgeText(s.text);
    setBadgeTextEn(s.text_en);
    setBadgeTextRu(s.text_ru);
    setDuration(String(s.suggested_days));
    setSuggestions([]);
    toast.info(pt.applied);
  };

  const startEdit = (p: Promotion) => {
    setEditingId(p.id);
    setSelectedService(p.service_id);
    setBadgeText(p.badge_text);
    setBadgeTextEn(p.badge_text_en);
    setBadgeTextRu(p.badge_text_ru);
    setBadgeColor(p.badge_color);
    const daysLeft = Math.max(1, differenceInDays(new Date(p.ends_at), new Date()));
    const closest = DURATION_OPTIONS.reduce((prev, curr) =>
      Math.abs(parseInt(curr.value) - daysLeft) < Math.abs(parseInt(prev.value) - daysLeft) ? curr : prev
    );
    setDuration(closest.value);
    setShowForm(true);
    setSuggestions([]);
  };

  const savePromotion = async () => {
    if (!selectedService || !badgeText.trim()) {
      toast.error(pt.pickServiceError);
      return;
    }
    setSaving(true);

    if (editingId) {
      const { error } = await supabase.from("promotions").update({
        service_id: selectedService,
        badge_text: badgeText.trim(),
        badge_text_en: badgeTextEn.trim(),
        badge_text_ru: badgeTextRu.trim(),
        badge_color: badgeColor,
        ends_at: addDays(new Date(), parseInt(duration)).toISOString(),
      }).eq("id", editingId);
      if (error) {
        toast.error(pt.failedUpdate);
      } else {
        toast.success(pt.promotionUpdated);
        resetForm();
        fetchAll();
        invalidatePublic();
      }
    } else {
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
        toast.error(pt.failedSave);
      } else {
        toast.success(pt.promotionCreated);
        resetForm();
        fetchAll();
        invalidatePublic();
      }
    }
    setSaving(false);
  };

  const deletePromo = async (id: string) => {
    await supabase.from("promotions").delete().eq("id", id);
    toast.success(pt.promotionRemoved);
    fetchAll();
    invalidatePublic();
  };

  const toggleActive = async (p: Promotion) => {
    await supabase.from("promotions").update({ active: !p.active }).eq("id", p.id);
    fetchAll();
    invalidatePublic();
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
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
          {activePromos.length} {pt.activeCount}{activePromos.length !== 1 ? "s" : ""}
        </p>
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2 w-full sm:w-auto" disabled={showForm}>
          <Plus size={14} /> {pt.addPromotion}
        </Button>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <DashboardCard
          title={editingId ? pt.editPromotion : pt.newPromotion}
          description={editingId ? pt.updateDesc : pt.addDesc}
        >
          <div className="space-y-4">
            {/* AI Suggestions — only for new */}
            {AI_ENABLED && !editingId && (
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={suggestBadges} disabled={suggestLoading} className="gap-2">
                  {suggestLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {pt.suggestWithAi}
                </Button>
              </div>
            )}

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
                      {pt.suggested.replace("{days}", String(s.suggested_days))}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Service picker */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{pt.service}</label>
              <Select value={selectedService} onValueChange={setSelectedService}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={pt.pickService} />
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
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{pt.badgeEs}</label>
                <Input value={badgeText} onChange={(e) => setBadgeText(e.target.value)} placeholder="Más popular" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{pt.badgeEn}</label>
                <Input value={badgeTextEn} onChange={(e) => setBadgeTextEn(e.target.value)} placeholder="Most popular" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{pt.badgeRu}</label>
                <Input value={badgeTextRu} onChange={(e) => setBadgeTextRu(e.target.value)} placeholder="Самый популярный" />
              </div>
            </div>

            {/* Color + Duration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">{pt.badgeColor}</label>
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
                <label className="text-xs font-medium text-muted-foreground mb-2 block">{pt.duration}</label>
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
                <label className="text-xs font-medium text-muted-foreground mb-3 block">{pt.preview} — {pt.previewDesc}</label>
                <div className="border border-border rounded-lg p-5 bg-background">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="font-semibold text-sm text-foreground">
                      {selectedService ? getServiceName(selectedService) : pt.serviceNamePlaceholder}
                    </span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${colorClasses(badgeColor)}`}>
                      {badgeText}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{pt.descriptionPlaceholder}</p>
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
                  {editingId
                    ? pt.extendsFromToday.replace("{days}", duration)
                    : pt.activeForDays.replace("{days}", duration)}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" size="sm" onClick={resetForm}>{pt.cancel}</Button>
              <Button size="sm" onClick={savePromotion} disabled={saving} className="gap-2">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Tag size={14} />}
                {editingId ? pt.saveChanges : pt.createPromotion}
              </Button>
            </div>
          </div>
        </DashboardCard>
      )}

      {/* Active promotions */}
      {activePromos.length > 0 && (
        <DashboardCard title={pt.active} description={pt.activeDesc}>
          <div className="space-y-3">
            {activePromos.map((p) => (
              <PromoRow key={p.id} promo={p} serviceName={getServiceName(p.service_id)} onDelete={deletePromo} onToggle={toggleActive} onEdit={startEdit} pt={pt} />
            ))}
          </div>
        </DashboardCard>
      )}

      {/* Expired / inactive */}
      {expiredPromos.length > 0 && (
        <DashboardCard title={pt.expiredInactive} description={pt.expiredDesc}>
          <div className="space-y-3">
            {expiredPromos.map((p) => (
              <PromoRow key={p.id} promo={p} serviceName={getServiceName(p.service_id)} onDelete={deletePromo} onToggle={toggleActive} onEdit={startEdit} expired pt={pt} />
            ))}
          </div>
        </DashboardCard>
      )}

      {promotions.length === 0 && !showForm && (
        <DashboardCard>
          <div className="text-center py-8">
            <Tag size={24} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-1">{pt.noPromotions}</p>
            <p className="text-xs text-muted-foreground">{pt.noPromotionsHint}</p>
          </div>
        </DashboardCard>
      )}
    </div>
  );
};

const PromoRow = ({ promo, serviceName, onDelete, onToggle, onEdit, expired, pt }: {
  promo: Promotion;
  serviceName: string;
  onDelete: (id: string) => void;
  onToggle: (p: Promotion) => void;
  onEdit: (p: Promotion) => void;
  expired?: boolean;
  pt: DashboardTranslations["promotions"];
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
              ? pt.ended.replace("{date}", format(endsAt, "MMM d"))
              : `${daysLeft} ${daysLeft !== 1 ? "days" : "day"} · ${format(endsAt, "MMM d")}`}
          </p>
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <Button variant="ghost" size="sm" onClick={() => onEdit(promo)} className="text-xs h-8">
          <Pencil size={14} />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onToggle(promo)} className="text-xs h-8">
          {promo.active ? pt.pause : pt.resume}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onDelete(promo.id)} className="text-destructive hover:text-destructive h-8">
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  );
};

// Need to import the type for PromoRow
import type { DashboardTranslations } from "@/i18n/dashboard";

export default DashboardPromotions;
