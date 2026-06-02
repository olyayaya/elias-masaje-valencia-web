import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Save, X, ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import DashboardCard from "./DashboardCard";
import LanguageTabs, { Lang, langKey, langVal } from "./LanguageTabs";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
  question_en: string;
  question_ru: string;
  answer_en: string;
  answer_ru: string;
}

const DashboardFAQ = () => {
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<FAQItem>>({});
  const [isNew, setIsNew] = useState(false);
  const [lang, setLang] = useState<Lang>("es");
  const queryClient = useQueryClient();

  const invalidatePublic = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.faqs });

  const fetchFaqs = async () => {
    const { data } = await supabase.from("faqs").select("*").order("sort_order", { ascending: true });
    if (data) setFaqs(data as FAQItem[]);
    setLoading(false);
  };

  useEffect(() => { fetchFaqs(); }, []);

  const startEdit = (f: FAQItem) => { setEditing(f.id); setDraft({ ...f }); setIsNew(false); };

  const startNew = () => {
    setDraft({ question: "", answer: "", sort_order: faqs.length, question_en: "", question_ru: "", answer_en: "", answer_ru: "" });
    setEditing("new");
    setIsNew(true);
  };

  const save = async () => {
    setSaving(true);
    if (isNew) {
      await supabase.from("faqs").insert({
        question: draft.question || "", answer: draft.answer || "",
        sort_order: draft.sort_order ?? faqs.length,
        question_en: draft.question_en || "", question_ru: draft.question_ru || "",
        answer_en: draft.answer_en || "", answer_ru: draft.answer_ru || "",
      });
    } else if (editing) {
      const { id, ...rest } = draft;
      await supabase.from("faqs").update(rest).eq("id", editing);
    }
    setEditing(null); setIsNew(false); setSaving(false);
    fetchFaqs();
    invalidatePublic();
  };

  const cancel = () => { setEditing(null); setIsNew(false); };

  const remove = async (id: string) => {
    await supabase.from("faqs").delete().eq("id", id);
    fetchFaqs();
    invalidatePublic();
  };

  const moveUp = async (index: number) => {
    if (index === 0) return;
    const arr = [...faqs];
    [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
    await Promise.all([
      supabase.from("faqs").update({ sort_order: index - 1 }).eq("id", arr[index - 1].id),
      supabase.from("faqs").update({ sort_order: index }).eq("id", arr[index].id),
    ]);
    fetchFaqs();
    invalidatePublic();
  };

  const moveDown = async (index: number) => {
    if (index === faqs.length - 1) return;
    const arr = [...faqs];
    [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
    await Promise.all([
      supabase.from("faqs").update({ sort_order: index }).eq("id", arr[index].id),
      supabase.from("faqs").update({ sort_order: index + 1 }).eq("id", arr[index + 1].id),
    ]);
    fetchFaqs();
    invalidatePublic();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" size={24} /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">{faqs.length} questions</p>
          <LanguageTabs active={lang} onChange={setLang} />
        </div>
        <button onClick={startNew} className="flex items-center gap-2 px-4 py-2 bg-foreground text-background text-sm rounded-lg hover:opacity-90 transition-colors">
          <Plus size={14} /> Add question
        </button>
      </div>

      {isNew && editing && (
        <DashboardCard>
          <FAQForm draft={draft} setDraft={setDraft} onSave={save} onCancel={cancel} saving={saving} lang={lang} />
        </DashboardCard>
      )}

      {faqs.map((f, i) => (
        <DashboardCard key={f.id}>
          {editing === f.id && !isNew ? (
            <FAQForm draft={draft} setDraft={setDraft} onSave={save} onCancel={cancel} saving={saving} lang={lang} />
          ) : (
            <div className="flex items-start gap-3">
              <div className="flex flex-col gap-0.5 shrink-0 pt-0.5">
                <button onClick={() => moveUp(i)} className="p-1 text-muted-foreground/40 hover:text-muted-foreground disabled:opacity-30" disabled={i === 0}><ChevronUp size={12} /></button>
                <button onClick={() => moveDown(i)} className="p-1 text-muted-foreground/40 hover:text-muted-foreground disabled:opacity-30" disabled={i === faqs.length - 1}><ChevronDown size={12} /></button>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-foreground">{langVal(f, "question", lang) || f.question}</h4>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{langVal(f, "answer", lang) || f.answer}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => startEdit(f)} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary"><Pencil size={14} /></button>
                <button onClick={() => remove(f.id)} className="p-2 text-muted-foreground hover:text-destructive rounded-lg hover:bg-secondary"><Trash2 size={14} /></button>
              </div>
            </div>
          )}
        </DashboardCard>
      ))}
    </div>
  );
};

const FAQForm = ({
  draft, setDraft, onSave, onCancel, saving, lang,
}: {
  draft: Partial<FAQItem>;
  setDraft: (d: Partial<FAQItem>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  lang: Lang;
}) => {
  const qKey = langKey("question", lang) as keyof FAQItem;
  const aKey = langKey("answer", lang) as keyof FAQItem;

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Question ({lang.toUpperCase()})</label>
        <input
          value={(draft[qKey] as string) || ""}
          onChange={(e) => setDraft({ ...draft, [qKey]: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground"
          placeholder="Enter question..."
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Answer ({lang.toUpperCase()})</label>
        <textarea
          value={(draft[aKey] as string) || ""}
          onChange={(e) => setDraft({ ...draft, [aKey]: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring resize-none bg-background text-foreground"
          placeholder="Enter answer..."
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

export default DashboardFAQ;
