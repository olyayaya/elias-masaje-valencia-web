import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Save, X, Loader2, Languages, Search, EyeOff, Eye, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DashboardCard from "./DashboardCard";
import LanguageTabs, { Lang, langKey, langVal } from "./LanguageTabs";
import { resolveField } from "@/hooks/use-db-content";
import { formatPrice } from "@/lib/format-price";
import { es as esT } from "@/i18n/es";
import { en as enT } from "@/i18n/en";
import { ru as ruT } from "@/i18n/ru";

const T_BY_LANG = { es: esT, en: enT, ru: ruT } as const;

interface Service {
  id: string;
  title: string;
  duration: string;
  price: string;
  description: string;
  sort_order: number;
  title_en: string;
  title_ru: string;
  description_en: string;
  description_ru: string;
  duration_en: string;
  duration_ru: string;
  price_en: string;
  price_ru: string;
  hidden: boolean;
  hide_price: boolean;
  hide_duration: boolean;
  hide_price_from: boolean;
}

const EMPTY_NEW: Partial<Service> = {
  title: "", duration: "", price: "", description: "",
  title_en: "", title_ru: "",
  description_en: "", description_ru: "",
  duration_en: "", duration_ru: "",
  price_en: "", price_ru: "",
  hide_price: false, hide_duration: false, hide_price_from: false,
};

const DashboardServices = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Service>>({});
  const [isNew, setIsNew] = useState(false);
  const [lang, setLang] = useState<Lang>("es");

  const fetchServices = async () => {
    const { data } = await supabase
      .from("services")
      .select("*")
      .order("sort_order", { ascending: true });
    if (data) setServices(data as Service[]);
    setLoading(false);
  };

  useEffect(() => { fetchServices(); }, []);

  const startEdit = (s: Service) => { setEditing(s.id); setDraft({ ...s }); setIsNew(false); };

  const startNew = () => {
    setDraft({ ...EMPTY_NEW, sort_order: services.length });
    setEditing("new");
    setIsNew(true);
  };

  const save = async () => {
    setSaving(true);
    if (isNew) {
      await supabase.from("services").insert({
        title: draft.title || "",
        duration: draft.duration || "",
        price: draft.price || "",
        description: draft.description || "",
        sort_order: draft.sort_order ?? services.length,
        title_en: draft.title_en || "",
        title_ru: draft.title_ru || "",
        description_en: draft.description_en || "",
        description_ru: draft.description_ru || "",
        duration_en: draft.duration_en || "",
        duration_ru: draft.duration_ru || "",
        price_en: draft.price_en || "",
        price_ru: draft.price_ru || "",
        hide_price: !!draft.hide_price,
        hide_duration: !!draft.hide_duration,
        hide_price_from: !!draft.hide_price_from,
      });
    } else if (editing) {
      const { id, ...rest } = draft;
      await supabase.from("services").update(rest).eq("id", editing);
    }
    setEditing(null); setIsNew(false); setSaving(false);
    fetchServices();
  };

  const cancel = () => { setEditing(null); setIsNew(false); };

  const remove = async (id: string) => {
    if (!confirm("Delete this service?")) return;
    await supabase.from("services").delete().eq("id", id);
    fetchServices();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" size={24} /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <p className="text-sm text-muted-foreground">{services.length} services · editing & previewing in</p>
          <LanguageTabs active={lang} onChange={setLang} />
          <span className="text-[11px] text-muted-foreground/70">Switch to instantly preview ES / EN / RU</span>
        </div>
        <button onClick={startNew} className="flex items-center gap-2 px-4 py-2 bg-foreground text-background text-sm rounded-lg hover:opacity-90 transition-colors">
          <Plus size={14} /> Add service
        </button>
      </div>

      {isNew && editing && (
        <DashboardCard>
          <ServiceForm draft={draft} setDraft={setDraft} onSave={save} onCancel={cancel} saving={saving} lang={lang} />
        </DashboardCard>
      )}

      {services.map((s) => {
        const previewTitle = resolveField(s, "title", lang);
        const previewDesc = resolveField(s, "description", lang);
        const previewDuration = resolveField(s, "duration", lang);
        const previewPrice = resolveField(s, "price", lang);
        const usingFallback = lang !== "es" && (
          !langVal(s, "title", lang) || !langVal(s, "description", lang)
        );
        return (
        <DashboardCard key={s.id}>
          {editing === s.id && !isNew ? (
            <ServiceForm draft={draft} setDraft={setDraft} onSave={save} onCancel={cancel} saving={saving} lang={lang} />
          ) : (
            <div className={`flex items-start justify-between gap-4 ${s.hidden ? "opacity-50" : ""}`}>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-medium text-foreground">{previewTitle}</h4>
                  {s.hidden && <span className="text-[10px] px-2 py-0.5 bg-secondary text-muted-foreground rounded-full">Hidden</span>}
                  {s.hide_price && <span className="text-[10px] px-2 py-0.5 bg-secondary text-muted-foreground rounded-full">No price</span>}
                  {s.hide_duration && <span className="text-[10px] px-2 py-0.5 bg-secondary text-muted-foreground rounded-full">No duration</span>}
                  {s.hide_price_from && <span className="text-[10px] px-2 py-0.5 bg-secondary text-muted-foreground rounded-full">No "from"</span>}
                  {usingFallback && <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">ES fallback</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{previewDesc}</p>
                <div className="flex gap-4 mt-2">
                  {!s.hide_duration && previewDuration && (
                    <span className="text-xs text-muted-foreground">{previewDuration}</span>
                  )}
                  {!s.hide_price && previewPrice && (
                    <span className="text-xs font-medium text-foreground">
                      {formatPrice(previewPrice, T_BY_LANG[lang], { hidePrefix: s.hide_price_from })}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={async () => { await supabase.from("services").update({ hidden: !s.hidden }).eq("id", s.id); fetchServices(); }} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary" title={s.hidden ? "Show on site" : "Hide from site"}>
                  {s.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button onClick={() => startEdit(s)} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary"><Pencil size={14} /></button>
                <button onClick={() => remove(s.id)} className="p-2 text-muted-foreground hover:text-destructive rounded-lg hover:bg-secondary"><Trash2 size={14} /></button>
              </div>
            </div>
          )}
        </DashboardCard>
        );
      })}
    </div>
  );
};

const inputClass =
  "w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground";

const ServiceForm = ({
  draft, setDraft, onSave, onCancel, saving, lang,
}: {
  draft: Partial<Service>;
  setDraft: (d: Partial<Service>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  lang: Lang;
}) => {
  const titleKey = langKey("title", lang) as keyof Service;
  const descKey = langKey("description", lang) as keyof Service;
  const durationKey = langKey("duration", lang) as keyof Service;
  const priceKey = langKey("price", lang) as keyof Service;
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  const callAi = async (action: "translate" | "seo_optimize", field: "title" | "description") => {
    const targetKey = field === "title" ? titleKey : descKey;
    const baseKey = field === "title" ? "title" : "description";
    const currentVal = (draft[targetKey] as string) || "";
    const sourceText = action === "translate"
      ? ((draft[baseKey as keyof Service] as string) || "")
      : currentVal;
    if (!sourceText.trim()) return;

    const key = `${action}-${field}`;
    setAiLoading(key);
    try {
      const { data, error } = await supabase.functions.invoke("ai-content-helper", {
        body: { text: sourceText, action, targetLang: lang, sourceLang: "es" },
      });
      if (error) throw error;
      if (data?.result) {
        setDraft({ ...draft, [targetKey]: data.result });
      }
    } catch (err) {
      console.error("AI helper error:", err);
    } finally {
      setAiLoading(null);
    }
  };

  const showTranslate = lang !== "es";
  const langTag = lang.toUpperCase();
  const placeholderHint = lang === "es" ? "" : ` (leave blank to inherit ES)`;

  const resetBtn = (key: keyof Service, baseKey: keyof Service) =>
    showTranslate ? (
      <button
        type="button"
        onClick={() => setDraft({ ...draft, [key]: (draft[baseKey] as string) || "" })}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-secondary"
        title="Reset to Spanish value"
      >
        <RotateCcw size={12} /> Reset to ES
      </button>
    ) : null;

  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-muted-foreground">Title ({langTag})</label>
          <div className="flex items-center gap-1">
            {resetBtn(titleKey, "title")}
            {showTranslate && (
              <button
                onClick={() => callAi("translate", "title")}
                disabled={!!aiLoading}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-secondary disabled:opacity-50"
                title="Translate from Spanish"
              >
                {aiLoading === "translate-title" ? <Loader2 size={12} className="animate-spin" /> : <Languages size={12} />}
                Translate from ES
              </button>
            )}
          </div>
        </div>
        <input
          value={(draft[titleKey] as string) || ""}
          onChange={(e) => setDraft({ ...draft, [titleKey]: e.target.value })}
          className={inputClass}
          placeholder={`Service name${placeholderHint}`}
        />
      </div>

      {/* Duration & Price (per-language) */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-muted-foreground">Duration ({langTag})</label>
            {resetBtn(durationKey, "duration")}
          </div>
          <input
            value={(draft[durationKey] as string) || ""}
            onChange={(e) => setDraft({ ...draft, [durationKey]: e.target.value })}
            className={inputClass}
            placeholder={lang === "es" ? "60 min" : lang === "en" ? "60 min" : "60 мин"}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-muted-foreground">Price ({langTag})</label>
            {resetBtn(priceKey, "price")}
          </div>
          <input
            value={(draft[priceKey] as string) || ""}
            onChange={(e) => setDraft({ ...draft, [priceKey]: e.target.value })}
            className={inputClass}
            placeholder={lang === "en" ? "€50" : "50 €"}
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-muted-foreground">Description ({langTag})</label>
          <div className="flex items-center gap-1">
            {resetBtn(descKey, "description")}
            {showTranslate && (
              <button
                onClick={() => callAi("translate", "description")}
                disabled={!!aiLoading}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-secondary disabled:opacity-50"
                title="Translate from Spanish"
              >
                {aiLoading === "translate-description" ? <Loader2 size={12} className="animate-spin" /> : <Languages size={12} />}
                Translate from ES
              </button>
            )}
            <button
              onClick={() => callAi("seo_optimize", "description")}
              disabled={!!aiLoading}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-secondary disabled:opacity-50"
              title="Optimize for SEO"
            >
              {aiLoading === "seo_optimize-description" ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
              SEO optimize
            </button>
          </div>
        </div>
        <textarea
          value={(draft[descKey] as string) || ""}
          onChange={(e) => setDraft({ ...draft, [descKey]: e.target.value })}
          rows={3}
          className={`${inputClass} resize-none`}
          placeholder={`Describe the service...${placeholderHint}`}
        />
      </div>

      {/* Visibility toggles (locale-independent) */}
      <div className="rounded-lg border border-border bg-secondary/40 p-3 space-y-2">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Display options (apply to all languages)</p>
        <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={!!draft.hide_price}
            onChange={(e) => setDraft({ ...draft, hide_price: e.target.checked })}
            className="rounded border-border"
          />
          Hide price on the public site
        </label>
        <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={!!draft.hide_duration}
            onChange={(e) => setDraft({ ...draft, hide_duration: e.target.checked })}
            className="rounded border-border"
          />
          Hide duration on the public site
        </label>
        <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={!!draft.hide_price_from}
            onChange={(e) => setDraft({ ...draft, hide_price_from: e.target.checked })}
            className="rounded border-border"
          />
          Hide the "from" / "desde" / "от" prefix before the price
        </label>
      </div>

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary">Cancel</button>
        <button onClick={onSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-foreground text-background text-sm rounded-lg hover:opacity-90 disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
        </button>
      </div>
    </div>
  );
};

export default DashboardServices;
