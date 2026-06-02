import { useState, useEffect } from "react";
import { History, RotateCcw, ChevronDown, ChevronRight, Loader2, Clock, Trash2, Pencil, CheckSquare, Square } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import DashboardCard from "./DashboardCard";

// Map history table_name → React Query key so a restore invalidates the
// public site read for the same table.
const TABLE_TO_QUERY_KEY: Record<string, readonly unknown[]> = {
  services: queryKeys.services,
  faqs: queryKeys.faqs,
  testimonials: queryKeys.testimonials,
  blog_posts: queryKeys.blogPosts,
};

interface HistoryEntry {
  id: string;
  table_name: string;
  record_id: string;
  snapshot: Record<string, any>;
  action: string;
  changed_at: string;
}

const TABLE_LABELS: Record<string, string> = {
  services: "Services",
  faqs: "FAQ",
  testimonials: "Testimonials",
  blog_posts: "Blog Posts",
};

const DISPLAY_FIELD: Record<string, string> = {
  services: "title",
  faqs: "question",
  testimonials: "name",
  blog_posts: "title",
};

const DashboardHistory = () => {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterTable, setFilterTable] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const queryClient = useQueryClient();

  const invalidateFor = (tableName: string) => {
    const key = TABLE_TO_QUERY_KEY[tableName];
    if (key) queryClient.invalidateQueries({ queryKey: key as readonly unknown[] });
  };

  const fetchHistory = async () => {
    const { data } = await supabase
      .from("content_history")
      .select("*")
      .order("changed_at", { ascending: false })
      .limit(100);
    if (data) setEntries(data as HistoryEntry[]);
    setLoading(false);
  };

  useEffect(() => { fetchHistory(); }, []);

  const restore = async (entry: HistoryEntry) => {
    setRestoring(entry.id);
    try {
      await restoreEntry(entry);
      toast.success("Restored to previous version");
      fetchHistory();
    } catch (err) {
      console.error("Restore failed:", err);
      toast.error("Restore failed");
    } finally {
      setRestoring(null);
    }
  };

  const restoreEntry = async (entry: HistoryEntry) => {
    const { id, created_at, updated_at, ...fields } = entry.snapshot;
    if (entry.action === "delete") {
      await supabase.from(entry.table_name as any).insert({ ...entry.snapshot, id: entry.record_id } as any);
    } else {
      await supabase.from(entry.table_name as any).update(fields as any).eq("id", entry.record_id);
    }
    invalidateFor(entry.table_name);
  };

  const runBulkUndo = async () => {
    setBulkRunning(true);
    // Restore newest-selected last so the final state is the oldest snapshot per record
    const ordered = entries
      .filter((e) => selected.has(e.id))
      .sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime());
    let ok = 0;
    for (const entry of ordered) {
      try {
        await restoreEntry(entry);
        ok++;
      } catch (e) {
        console.error("Bulk undo failed for", entry.id, e);
      }
    }
    setBulkRunning(false);
    setBulkOpen(false);
    setSelected(new Set());
    toast.success(`Restored ${ok} of ${ordered.length} changes`);
    fetchHistory();
  };

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const filtered = filterTable === "all" ? entries : entries.filter(e => e.table_name === filterTable);

  const allFilteredSelected = filtered.length > 0 && filtered.every((e) => selected.has(e.id));
  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((e) => next.delete(e.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((e) => next.add(e.id));
        return next;
      });
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" size={24} /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">{filtered.length} changes recorded</p>
          {filtered.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {allFilteredSelected ? <CheckSquare size={14} /> : <Square size={14} />}
              {allFilteredSelected ? "Deselect all" : "Select all"}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button
              onClick={() => setBulkOpen(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity"
            >
              <RotateCcw size={12} />
              Undo {selected.size} selected
            </button>
          )}
          <select
            value={filterTable}
            onChange={(e) => setFilterTable(e.target.value)}
            className="px-3 py-1.5 text-xs border border-border rounded-lg focus:outline-none text-foreground bg-background"
          >
            <option value="all">All sections</option>
            {Object.entries(TABLE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 && (
        <DashboardCard>
          <div className="text-center py-8 text-muted-foreground">
            <History size={32} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">No changes recorded yet</p>
            <p className="text-xs mt-1">Edit any content item and its previous versions will appear here</p>
          </div>
        </DashboardCard>
      )}

      {filtered.map((entry) => {
        const isExpanded = expandedId === entry.id;
        const displayField = DISPLAY_FIELD[entry.table_name] || "id";
        const itemName = entry.snapshot[displayField] || entry.record_id.slice(0, 8);

        return (
          <DashboardCard key={entry.id}>
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <button
                    onClick={() => toggleSelect(entry.id)}
                    className="mt-0.5 text-muted-foreground hover:text-foreground shrink-0"
                    aria-label="Select for bulk undo"
                  >
                    {selected.has(entry.id) ? <CheckSquare size={14} /> : <Square size={14} />}
                  </button>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    className="flex items-start gap-2 text-left flex-1 min-w-0"
                  >
                    {isExpanded ? <ChevronDown size={14} className="mt-0.5 text-muted-foreground shrink-0" /> : <ChevronRight size={14} className="mt-0.5 text-muted-foreground shrink-0" />}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                          entry.action === "delete" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                        }`}>
                          {entry.action === "delete" ? <Trash2 size={9} className="inline mr-0.5 -mt-px" /> : <Pencil size={9} className="inline mr-0.5 -mt-px" />}
                          {entry.action}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 bg-secondary text-muted-foreground rounded-full">
                          {TABLE_LABELS[entry.table_name] || entry.table_name}
                        </span>
                      </div>
                      <h4 className="text-sm font-medium text-foreground mt-1 truncate">{itemName}</h4>
                    </div>
                  </button>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock size={10} />
                    {formatDate(entry.changed_at)}
                  </span>
                  <button
                    onClick={() => restore(entry)}
                    disabled={restoring === entry.id}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg hover:bg-secondary border border-border disabled:opacity-50"
                    title="Restore this version"
                  >
                    {restoring === entry.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                    Restore
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="ml-6 mt-2 p-3 bg-secondary rounded-lg overflow-x-auto">
                  <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
                    {Object.entries(entry.snapshot)
                      .filter(([k]) => !["id", "created_at", "updated_at"].includes(k))
                      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
                      .join("\n")}
                  </pre>
                </div>
              )}
            </div>
          </DashboardCard>
        );
      })}

      <AlertDialog open={bulkOpen} onOpenChange={(o) => !o && setBulkOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo {selected.size} change{selected.size === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Each selected item will be restored to the snapshot shown in this row. Changes go live immediately. If multiple snapshots exist for the same record, the oldest selected one wins.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-64 overflow-auto space-y-1 text-xs border border-border rounded-lg p-3">
            {entries.filter((e) => selected.has(e.id)).map((e) => {
              const name = e.snapshot[DISPLAY_FIELD[e.table_name] || "id"] || e.record_id.slice(0, 8);
              return (
                <div key={e.id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-foreground">{name}</span>
                  <span className="text-muted-foreground shrink-0">{TABLE_LABELS[e.table_name] || e.table_name} · {formatDate(e.changed_at)}</span>
                </div>
              );
            })}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkRunning}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runBulkUndo} disabled={bulkRunning}>
              {bulkRunning ? <Loader2 size={14} className="animate-spin mr-1" /> : <RotateCcw size={14} className="mr-1" />}
              Undo all selected
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DashboardHistory;
