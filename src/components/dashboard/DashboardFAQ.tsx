import { useState } from "react";
import { Plus, GripVertical, Pencil, Trash2, Save, X, ChevronUp, ChevronDown } from "lucide-react";
import DashboardCard from "./DashboardCard";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

const initialFaqs: FAQItem[] = [
  { id: "1", question: "¿Necesito traer algo a la sesión?", answer: "No, solo necesitas venir con ropa cómoda. Todo lo demás lo proporciono yo." },
  { id: "2", question: "¿Cuánto dura una sesión?", answer: "Las sesiones duran entre 45 y 90 minutos dependiendo del tratamiento." },
  { id: "3", question: "¿Se puede cancelar o reprogramar?", answer: "Sí, con al menos 24 horas de antelación sin coste." },
  { id: "4", question: "¿Qué métodos de pago aceptáis?", answer: "Aceptamos efectivo, tarjeta y Bizum." },
];

const DashboardFAQ = () => {
  const [faqs, setFaqs] = useState<FAQItem[]>(initialFaqs);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<FAQItem>({ id: "", question: "", answer: "" });
  const [isNew, setIsNew] = useState(false);

  const startEdit = (f: FAQItem) => {
    setEditing(f.id);
    setDraft({ ...f });
    setIsNew(false);
  };

  const startNew = () => {
    const nf = { id: Date.now().toString(), question: "", answer: "" };
    setDraft(nf);
    setEditing(nf.id);
    setIsNew(true);
  };

  const save = () => {
    if (isNew) {
      setFaqs([...faqs, draft]);
    } else {
      setFaqs(faqs.map((f) => (f.id === draft.id ? draft : f)));
    }
    setEditing(null);
    setIsNew(false);
  };

  const cancel = () => {
    setEditing(null);
    setIsNew(false);
  };

  const remove = (id: string) => {
    setFaqs(faqs.filter((f) => f.id !== id));
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const arr = [...faqs];
    [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
    setFaqs(arr);
  };

  const moveDown = (index: number) => {
    if (index === faqs.length - 1) return;
    const arr = [...faqs];
    [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
    setFaqs(arr);
  };

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
          <FAQForm draft={draft} setDraft={setDraft} onSave={save} onCancel={cancel} />
        </DashboardCard>
      )}

      {faqs.map((f, i) => (
        <DashboardCard key={f.id}>
          {editing === f.id && !isNew ? (
            <FAQForm draft={draft} setDraft={setDraft} onSave={save} onCancel={cancel} />
          ) : (
            <div className="flex items-start gap-3">
              <div className="flex flex-col gap-0.5 shrink-0 pt-0.5">
                <button
                  onClick={() => moveUp(i)}
                  className="p-1 text-gray-300 hover:text-gray-500 disabled:opacity-30"
                  disabled={i === 0}
                >
                  <ChevronUp size={12} />
                </button>
                <button
                  onClick={() => moveDown(i)}
                  className="p-1 text-gray-300 hover:text-gray-500 disabled:opacity-30"
                  disabled={i === faqs.length - 1}
                >
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
  draft, setDraft, onSave, onCancel,
}: {
  draft: FAQItem;
  setDraft: (d: FAQItem) => void;
  onSave: () => void;
  onCancel: () => void;
}) => (
  <div className="space-y-4">
    <div>
      <label className="text-xs font-medium text-gray-500 mb-1 block">Question</label>
      <input
        value={draft.question}
        onChange={(e) => setDraft({ ...draft, question: e.target.value })}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
        placeholder="Enter question..."
      />
    </div>
    <div>
      <label className="text-xs font-medium text-gray-500 mb-1 block">Answer</label>
      <textarea
        value={draft.answer}
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
      <button onClick={onSave} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800">
        <Save size={14} /> Save
      </button>
    </div>
  </div>
);

export default DashboardFAQ;
