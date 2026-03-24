import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Save, X, ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DashboardCard from "./DashboardCard";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
}

const DashboardFAQ = () => {
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<FAQItem>>({});
  const [isNew, setIsNew] = useState(false);

  const fetchFaqs = async () => {
    const { data } = await supabase
      .from("faqs")
      .select("*")
      .order("sort_order", { ascending: true });
    if (data) setFaqs(data);
    setLoading(false);
  };

  useEffect(() => { fetchFaqs(); }, []);

  const startEdit = (f: FAQItem) => {
    setEditing(f.id);
    setDraft({ ...f });
    setIsNew(false);
  };

  const startNew = () => {
    setDraft({ question: "", answer: "", sort_order: faqs.length });
    setEditing("new");
    setIsNew(true);
  };

  const save = async () => {
    setSaving(true);
    if (isNew) {
      await supabase.from("faqs").insert({
        question: draft.question || "",
        answer: draft.answer || "",
        sort_order: draft.sort_order ?? faqs.length,
      });
    } else if (editing) {
      await supabase.from("faqs").update({
        question: draft.question,
        answer: draft.answer,
      }).eq("id", editing);
    }
    setEditing(null);
    setIsNew(false);
    setSaving(false);
    fetchFaqs();
  };

  const cancel = () => {
    setEditing(null);
    setIsNew(false);
  };

  const remove = async (id: string) => {
    await supabase.from("faqs").delete().eq("id", id);
    fetchFaqs();
  };

  const moveUp = async (index: number) => {
    if (index === 0) return;
    const arr = [...faqs];
    [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
    // Update sort_order for both
    await Promise.all([
      supabase.from("faqs").update({ sort_order: index - 1 }).eq("id", arr[index - 1].id),
      supabase.from("faqs").update({ sort_order: index }).eq("id", arr[index].id),
    ]);
    fetchFaqs();
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
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={24} /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{faqs.length} questions</p>
        <button
          onClick={startNew}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Plus size={14} /> Add question
        </button>
      </div>

      {isNew && editing && (
        <DashboardCard>
          <FAQForm draft={draft} setDraft={setDraft} onSave={save} onCancel={cancel} saving={saving} />
        </DashboardCard>
      )}

      {faqs.map((f, i) => (
        <DashboardCard key={f.id}>
          {editing === f.id && !isNew ? (
            <FAQForm draft={draft} setDraft={setDraft} onSave={save} onCancel={cancel} saving={saving} />
          ) : (
            <div className="flex items-start gap-3">
              <div className="flex flex-col gap-0.5 shrink-0 pt-0.5">
                <button onClick={() => moveUp(i)} className="p-1 text-gray-300 hover:text-gray-500 disabled:opacity-30" disabled={i === 0}>
                  <ChevronUp size={12} />
                </button>
                <button onClick={() => moveDown(i)} className="p-1 text-gray-300 hover:text-gray-500 disabled:opacity-30" disabled={i === faqs.length - 1}>
                  <ChevronDown size={12} />
                </button>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-gray-900">{f.question}</h4>
                <p className="text-xs text-gray-400 mt-1 line-clamp-2">{f.answer}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => startEdit(f)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50">
                  <Pencil size={14} />
                </button>
                <button onClick={() => remove(f.id)} className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-50">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )}
        </DashboardCard>
      ))}
    </div>
  );
};

const FAQForm = ({
  draft, setDraft, onSave, onCancel, saving,
}: {
  draft: Partial<FAQItem>;
  setDraft: (d: Partial<FAQItem>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) => (
  <div className="space-y-4">
    <div>
      <label className="text-xs font-medium text-gray-500 mb-1 block">Question</label>
      <input
        value={draft.question || ""}
        onChange={(e) => setDraft({ ...draft, question: e.target.value })}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
        placeholder="Enter question..."
      />
    </div>
    <div>
      <label className="text-xs font-medium text-gray-500 mb-1 block">Answer</label>
      <textarea
        value={draft.answer || ""}
        onChange={(e) => setDraft({ ...draft, answer: e.target.value })}
        rows={3}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none"
        placeholder="Enter answer..."
      />
    </div>
    <div className="flex gap-2 justify-end">
      <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-50">
        Cancel
      </button>
      <button onClick={onSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50">
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
      </button>
    </div>
  </div>
);

export default DashboardFAQ;
