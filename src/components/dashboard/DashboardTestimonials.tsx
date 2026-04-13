import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Save, Star, Loader2, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DashboardCard from "./DashboardCard";
import LanguageTabs, { Lang, langKey, langVal } from "./LanguageTabs";

interface Testimonial {
  id: string;
  name: string;
  quote: string;
  source: string;
  rating: number;
  quote_en: string;
  quote_ru: string;
  hidden: boolean;
}

const DashboardTestimonials = () => {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Testimonial>>({});
  const [isNew, setIsNew] = useState(false);
  const [lang, setLang] = useState<Lang>("es");

  const fetchTestimonials = async () => {
    const { data } = await supabase.from("testimonials").select("*").order("created_at", { ascending: false });
    if (data) setItems(data as Testimonial[]);
    setLoading(false);
  };

  useEffect(() => { fetchTestimonials(); }, []);

  const startNew = () => {
    setDraft({ name: "", quote: "", source: "Google", rating: 5, quote_en: "", quote_ru: "" });
    setEditing("new"); setIsNew(true);
  };

  const startEdit = (t: Testimonial) => { setDraft({ ...t }); setEditing(t.id); setIsNew(false); };

  const save = async () => {
    setSaving(true);
    if (isNew) {
      await supabase.from("testimonials").insert({
        name: draft.name || "", quote: draft.quote || "",
        source: draft.source || "Google", rating: draft.rating ?? 5,
        quote_en: draft.quote_en || "", quote_ru: draft.quote_ru || "",
      });
    } else if (editing) {
      const { id, ...rest } = draft;
      await supabase.from("testimonials").update(rest).eq("id", editing);
    }
    setEditing(null); setIsNew(false); setSaving(false);
    fetchTestimonials();
  };

  const cancel = () => { setEditing(null); setIsNew(false); };

  const remove = async (id: string) => {
    await supabase.from("testimonials").delete().eq("id", id);
    fetchTestimonials();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" size={24} /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">{items.length} testimonials</p>
          <LanguageTabs active={lang} onChange={setLang} />
        </div>
        <button onClick={startNew} className="flex items-center gap-2 px-4 py-2 bg-foreground text-background text-sm rounded-lg hover:opacity-90 transition-colors">
          <Plus size={14} /> Add testimonial
        </button>
      </div>

      {isNew && editing && (
        <DashboardCard>
          <TestimonialForm draft={draft} setDraft={setDraft} onSave={save} onCancel={cancel} saving={saving} lang={lang} />
        </DashboardCard>
      )}

      {items.map((t) => (
        <DashboardCard key={t.id}>
          {editing === t.id && !isNew ? (
            <TestimonialForm draft={draft} setDraft={setDraft} onSave={save} onCancel={cancel} saving={saving} lang={lang} />
          ) : (
            <div className={`flex items-start justify-between gap-4 ${t.hidden ? "opacity-50" : ""}`}>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-medium text-foreground">{t.name}</h4>
                  <span className="text-[10px] px-2 py-0.5 bg-secondary text-muted-foreground rounded-full">{t.source}</span>
                  {t.hidden && <span className="text-[10px] px-2 py-0.5 bg-secondary text-muted-foreground rounded-full">Hidden</span>}
                </div>
                <div className="flex gap-0.5 mb-1.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={12} className={i < t.rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"} />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground italic">"{langVal(t, "quote", lang) || t.quote}"</p>
              </div>
              <div className="flex gap-1">
                <button onClick={async () => { await supabase.from("testimonials").update({ hidden: !t.hidden }).eq("id", t.id); fetchTestimonials(); }} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary" title={t.hidden ? "Show on site" : "Hide from site"}>
                  {t.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button onClick={() => startEdit(t)} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary"><Pencil size={14} /></button>
                <button onClick={() => remove(t.id)} className="p-2 text-muted-foreground hover:text-destructive rounded-lg hover:bg-secondary"><Trash2 size={14} /></button>
              </div>
            </div>
          )}
        </DashboardCard>
      ))}
    </div>
  );
};

const TestimonialForm = ({
  draft, setDraft, onSave, onCancel, saving, lang,
}: {
  draft: Partial<Testimonial>;
  setDraft: (d: Partial<Testimonial>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  lang: Lang;
}) => {
  const quoteKey = langKey("quote", lang) as keyof Testimonial;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Client name</label>
          <input
            value={draft.name || ""}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground"
            placeholder="Name"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Source</label>
          <select
            value={draft.source || "Google"}
            onChange={(e) => setDraft({ ...draft, source: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none bg-background text-foreground"
          >
            <option value="Google">Google</option>
            <option value="TripAdvisor">TripAdvisor</option>
            <option value="Instagram">Instagram</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Rating</label>
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <button key={i} onClick={() => setDraft({ ...draft, rating: i + 1 })} className="p-0.5">
              <Star size={18} className={i < (draft.rating ?? 5) ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"} />
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Quote ({lang.toUpperCase()})</label>
        <textarea
          value={(draft[quoteKey] as string) || ""}
          onChange={(e) => setDraft({ ...draft, [quoteKey]: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring resize-none bg-background text-foreground"
          placeholder="Client's feedback..."
        />
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

export default DashboardTestimonials;
