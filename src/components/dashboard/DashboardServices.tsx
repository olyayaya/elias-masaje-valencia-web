import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Save, X, Loader2, Sparkles, Languages, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DashboardCard from "./DashboardCard";
import LanguageTabs, { Lang, langKey, langVal } from "./LanguageTabs";

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
}

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

  const startEdit = (s: Service) => {
    setEditing(s.id);
    setDraft({ ...s });
    setIsNew(false);
  };

  const startNew = () => {
    setDraft({ title: "", duration: "", price: "", description: "", sort_order: services.length, title_en: "", title_ru: "", description_en: "", description_ru: "" });
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
      });
    } else if (editing) {
      const { id, ...rest } = draft;
      await supabase.from("services").update(rest).eq("id", editing);
    }
    setEditing(null);
    setIsNew(false);
    setSaving(false);
    fetchServices();
  };

  const cancel = () => { setEditing(null); setIsNew(false); };

  const remove = async (id: string) => {
    await supabase.from("services").delete().eq("id", id);
    fetchServices();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={24} /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <p className="text-sm text-gray-500">{services.length} services</p>
          <LanguageTabs active={lang} onChange={setLang} />
        </div>
        <button onClick={startNew} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors">
          <Plus size={14} /> Add service
        </button>
      </div>

      {isNew && editing && (
        <DashboardCard>
          <ServiceForm draft={draft} setDraft={setDraft} onSave={save} onCancel={cancel} saving={saving} lang={lang} />
        </DashboardCard>
      )}

      {services.map((s) => (
        <DashboardCard key={s.id}>
          {editing === s.id && !isNew ? (
            <ServiceForm draft={draft} setDraft={setDraft} onSave={save} onCancel={cancel} saving={saving} lang={lang} />
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-gray-900">{langVal(s, "title", lang) || s.title}</h4>
                <p className="text-xs text-gray-400 mt-1">{langVal(s, "description", lang) || s.description}</p>
                <div className="flex gap-4 mt-2">
                  <span className="text-xs text-gray-500">{s.duration}</span>
                  <span className="text-xs font-medium text-gray-700">{s.price}</span>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => startEdit(s)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50"><Pencil size={14} /></button>
                <button onClick={() => remove(s.id)} className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-50"><Trash2 size={14} /></button>
              </div>
            </div>
          )}
        </DashboardCard>
      ))}
    </div>
  );
};

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
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  const callAi = async (action: "translate" | "seo_optimize") => {
    const currentDesc = (draft[descKey] as string) || "";
    // For translate, use ES description as source if editing EN/RU
    const sourceText = action === "translate" ? (draft.description || "") : currentDesc;
    if (!sourceText.trim()) return;

    setAiLoading(action);
    try {
      const { data, error } = await supabase.functions.invoke("ai-content-helper", {
        body: {
          text: sourceText,
          action,
          targetLang: lang,
          sourceLang: "es",
        },
      });
      if (error) throw error;
      if (data?.result) {
        setDraft({ ...draft, [descKey]: data.result });
      }
    } catch (err) {
      console.error("AI helper error:", err);
    } finally {
      setAiLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Title ({lang.toUpperCase()})</label>
          <input
            value={(draft[titleKey] as string) || ""}
            onChange={(e) => setDraft({ ...draft, [titleKey]: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
            placeholder="Service name"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Duration</label>
            <input
              value={draft.duration || ""}
              onChange={(e) => setDraft({ ...draft, duration: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
              placeholder="60 min"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Price</label>
            <input
              value={draft.price || ""}
              onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
              placeholder="50 €"
            />
          </div>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-gray-500">Description ({lang.toUpperCase()})</label>
          <div className="flex items-center gap-1">
            {lang !== "es" && (
              <button
                onClick={() => callAi("translate")}
                disabled={!!aiLoading}
                className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 px-2 py-1 rounded-md hover:bg-gray-50 disabled:opacity-50"
                title="Translate from Spanish"
              >
                {aiLoading === "translate" ? <Loader2 size={12} className="animate-spin" /> : <Languages size={12} />}
                Translate from ES
              </button>
            )}
            <button
              onClick={() => callAi("seo_optimize")}
              disabled={!!aiLoading}
              className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 px-2 py-1 rounded-md hover:bg-gray-50 disabled:opacity-50"
              title="Optimize for SEO"
            >
              {aiLoading === "seo_optimize" ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
              SEO optimize
            </button>
          </div>
        </div>
        <textarea
          value={(draft[descKey] as string) || ""}
          onChange={(e) => setDraft({ ...draft, [descKey]: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 resize-none"
          placeholder="Describe the service..."
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
        <button onClick={onSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
        </button>
      </div>
    </div>
  );
};

export default DashboardServices;
