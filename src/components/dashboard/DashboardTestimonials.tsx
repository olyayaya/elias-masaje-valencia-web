import { useState } from "react";
import { Plus, Pencil, Trash2, Save, Star } from "lucide-react";
import DashboardCard from "./DashboardCard";

interface Testimonial {
  id: string;
  name: string;
  quote: string;
  source: string;
  rating: number;
}

const initialTestimonials: Testimonial[] = [
  { id: "1", name: "María López", quote: "Elías es un masajista increíble. Fui a él por un fuerte dolor de cuello.", source: "Google", rating: 5 },
  { id: "2", name: "Carlos Ruiz", quote: "Experiencia para repetir más de una vez. El espacio, el trato, su profesionalidad.", source: "TripAdvisor", rating: 5 },
  { id: "3", name: "Ana García", quote: "Gran profesional. Variedad de tratamientos adecuados para cada necesidad.", source: "Google", rating: 5 },
];

const DashboardTestimonials = () => {
  const [items, setItems] = useState<Testimonial[]>(initialTestimonials);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Testimonial>({ id: "", name: "", quote: "", source: "Google", rating: 5 });
  const [isNew, setIsNew] = useState(false);

  const startNew = () => {
    const nt: Testimonial = { id: Date.now().toString(), name: "", quote: "", source: "Google", rating: 5 };
    setDraft(nt);
    setEditing(nt.id);
    setIsNew(true);
  };

  const startEdit = (t: Testimonial) => {
    setDraft({ ...t });
    setEditing(t.id);
    setIsNew(false);
  };

  const save = () => {
    if (isNew) {
      setItems([...items, draft]);
    } else {
      setItems(items.map((t) => (t.id === draft.id ? draft : t)));
    }
    setEditing(null);
    setIsNew(false);
  };

  const cancel = () => {
    setEditing(null);
    setIsNew(false);
  };

  const remove = (id: string) => {
    setItems(items.filter((t) => t.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{items.length} testimonials</p>
        <button
          onClick={startNew}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Plus size={14} /> Add testimonial
        </button>
      </div>

      {isNew && editing && (
        <DashboardCard>
          <TestimonialForm draft={draft} setDraft={setDraft} onSave={save} onCancel={cancel} />
        </DashboardCard>
      )}

      {items.map((t) => (
        <DashboardCard key={t.id}>
          {editing === t.id && !isNew ? (
            <TestimonialForm draft={draft} setDraft={setDraft} onSave={save} onCancel={cancel} />
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-medium text-gray-900">{t.name}</h4>
                  <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">{t.source}</span>
                </div>
                <div className="flex gap-0.5 mb-1.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={12} className={i < t.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200"} />
                  ))}
                </div>
                <p className="text-xs text-gray-400 italic">"{t.quote}"</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => startEdit(t)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50">
                  <Pencil size={14} />
                </button>
                <button onClick={() => remove(t.id)} className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-50">
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

const TestimonialForm = ({
  draft, setDraft, onSave, onCancel,
}: {
  draft: Testimonial;
  setDraft: (d: Testimonial) => void;
  onSave: () => void;
  onCancel: () => void;
}) => (
  <div className="space-y-4">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Client name</label>
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          placeholder="Name"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Source</label>
        <select
          value={draft.source}
          onChange={(e) => setDraft({ ...draft, source: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none"
        >
          <option value="Google">Google</option>
          <option value="TripAdvisor">TripAdvisor</option>
          <option value="Instagram">Instagram</option>
          <option value="Other">Other</option>
        </select>
      </div>
    </div>

    <div>
      <label className="text-xs font-medium text-gray-500 mb-1 block">Rating</label>
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <button
            key={i}
            onClick={() => setDraft({ ...draft, rating: i + 1 })}
            className="p-0.5"
          >
            <Star size={18} className={i < draft.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200"} />
          </button>
        ))}
      </div>
    </div>

    <div>
      <label className="text-xs font-medium text-gray-500 mb-1 block">Quote</label>
      <textarea
        value={draft.quote}
        onChange={(e) => setDraft({ ...draft, quote: e.target.value })}
        rows={3}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none"
        placeholder="Client's feedback..."
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

export default DashboardTestimonials;
