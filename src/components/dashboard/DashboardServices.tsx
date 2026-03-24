import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Save, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DashboardCard from "./DashboardCard";

interface Service {
  id: string;
  title: string;
  duration: string;
  price: string;
  description: string;
  sort_order: number;
}

const DashboardServices = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Service>>({});
  const [isNew, setIsNew] = useState(false);

  const fetchServices = async () => {
    const { data } = await supabase
      .from("services")
      .select("*")
      .order("sort_order", { ascending: true });
    if (data) setServices(data);
    setLoading(false);
  };

  useEffect(() => { fetchServices(); }, []);

  const startEdit = (s: Service) => {
    setEditing(s.id);
    setDraft({ ...s });
    setIsNew(false);
  };

  const startNew = () => {
    setDraft({ title: "", duration: "", price: "", description: "", sort_order: services.length });
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

  const cancel = () => {
    setEditing(null);
    setIsNew(false);
  };

  const remove = async (id: string) => {
    await supabase.from("services").delete().eq("id", id);
    fetchServices();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={24} /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{services.length} services</p>
        <button
          onClick={startNew}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Plus size={14} /> Add service
        </button>
      </div>

      {isNew && editing && (
        <DashboardCard>
          <ServiceForm draft={draft} setDraft={setDraft} onSave={save} onCancel={cancel} saving={saving} />
        </DashboardCard>
      )}

      {services.map((s) => (
        <DashboardCard key={s.id}>
          {editing === s.id && !isNew ? (
            <ServiceForm draft={draft} setDraft={setDraft} onSave={save} onCancel={cancel} saving={saving} />
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-gray-900">{s.title}</h4>
                <p className="text-xs text-gray-400 mt-1">{s.description}</p>
                <div className="flex gap-4 mt-2">
                  <span className="text-xs text-gray-500">{s.duration}</span>
                  <span className="text-xs font-medium text-gray-700">{s.price}</span>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => startEdit(s)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50">
                  <Pencil size={14} />
                </button>
                <button onClick={() => remove(s.id)} className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-50">
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

const ServiceForm = ({
  draft, setDraft, onSave, onCancel, saving,
}: {
  draft: Partial<Service>;
  setDraft: (d: Partial<Service>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) => (
  <div className="space-y-4">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Title</label>
        <input
          value={draft.title || ""}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
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
      <label className="text-xs font-medium text-gray-500 mb-1 block">Description</label>
      <textarea
        value={draft.description || ""}
        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        rows={3}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 resize-none"
        placeholder="Describe the service..."
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

export default DashboardServices;
