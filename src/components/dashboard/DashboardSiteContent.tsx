import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardCard from "./DashboardCard";
import LanguageTabs, { type Lang } from "./LanguageTabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Save, Loader2, Sparkles, ChevronRight, Search, Languages } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SiteContentRow {
  id: string;
  content_key: string;
  value_es: string;
  value_en: string;
  value_ru: string;
  category: string;
  label: string;
  sort_order: number;
}

const CATEGORIES = [
  { id: "contact", label: "Contact & Location" },
  { id: "hero", label: "Hero Section" },
  { id: "cta", label: "CTAs & Gift Card" },
  { id: "about", label: "About Preview" },
  { id: "footer", label: "Footer" },
  { id: "location", label: "Location" },
];

const langKey = (lang: Lang): "value_es" | "value_en" | "value_ru" =>
  lang === "es" ? "value_es" : lang === "en" ? "value_en" : "value_ru";

const isLongField = (key: string) =>
  key.includes("description") || key.includes("tagline") || key.includes("preview_p");

const DashboardSiteContent = () => {
  const [items, setItems] = useState<SiteContentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>("es");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  const fetchContent = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("site_content")
      .select("*")
      .order("sort_order", { ascending: true });
    if (data) {
      setItems(data as SiteContentRow[]);
      const d: Record<string, string> = {};
      data.forEach((r: any) => { d[r.id] = r[langKey(lang)]; });
      setDrafts(d);
    }
    setLoading(false);
  };

  useEffect(() => { fetchContent(); }, []);

  useEffect(() => {
    const d: Record<string, string> = {};
    items.forEach((r) => { d[r.id] = r[langKey(lang)]; });
    setDrafts(d);
  }, [lang, items]);

  const saveItem = async (item: SiteContentRow) => {
    setSaving(item.id);
    const { error } = await supabase
      .from("site_content")
      .update({ [langKey(lang)]: drafts[item.id] })
      .eq("id", item.id);
    if (error) {
      toast.error("Failed to save");
    } else {
      toast.success(`${item.label} saved`);
      setItems((prev) =>
        prev.map((r) => r.id === item.id ? { ...r, [langKey(lang)]: drafts[item.id] } : r)
      );
    }
    setSaving(null);
  };

  const translateField = async (item: SiteContentRow) => {
    if (lang === "es") {
      toast.info("Select EN or RU to translate from Spanish");
      return;
    }
    setTranslating(item.id);
    try {
      const targetLang = lang === "en" ? "English" : "Russian";
      const { data, error } = await supabase.functions.invoke("ai-content-helper", {
        body: { text: item.value_es, action: "translate", targetLang, sourceLang: "es" },
      });
      if (error) throw error;
      if (data?.result) {
        setDrafts((prev) => ({ ...prev, [item.id]: data.result }));
        toast.success("Translation ready — review and save");
      }
    } catch {
      toast.error("Translation failed");
    }
    setTranslating(null);
  };

  const hasChanged = (item: SiteContentRow) => drafts[item.id] !== item[langKey(lang)];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{items.length} editable fields</p>
        <LanguageTabs active={lang} onChange={setLang} />
      </div>

      {CATEGORIES.map((cat) => {
        const catItems = items.filter((i) => i.category === cat.id);
        if (!catItems.length) return null;
        return (
          <Collapsible key={cat.id}>
            <CollapsibleTrigger className="w-full text-left">
              <DashboardCard title={cat.label} description={`Edit ${cat.label.toLowerCase()} text`}>
                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                  <ChevronRight size={14} className="transition-transform duration-200 group-data-[state=open]:rotate-90" />
                  <span>{catItems.length} fields — click to expand</span>
                </div>
              </DashboardCard>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border border-t-0 border-border rounded-b-lg bg-card px-5 pb-5 pt-3 space-y-4">
                {catItems.map((item) => (
                  <div key={item.id} className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">{item.label}</label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        {isLongField(item.content_key) ? (
                          <Textarea
                            value={drafts[item.id] ?? ""}
                            onChange={(e) => setDrafts((p) => ({ ...p, [item.id]: e.target.value }))}
                            rows={3}
                            className="text-sm"
                          />
                        ) : (
                          <Input
                            value={drafts[item.id] ?? ""}
                            onChange={(e) => setDrafts((p) => ({ ...p, [item.id]: e.target.value }))}
                            className="text-sm"
                          />
                        )}
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        {lang !== "es" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => translateField(item)}
                            disabled={translating === item.id}
                            className="h-10"
                          >
                            {translating === item.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Sparkles size={14} />
                            )}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => saveItem(item)}
                          disabled={saving === item.id || !hasChanged(item)}
                          className="h-10"
                        >
                          {saving === item.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Save size={14} />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
};

export default DashboardSiteContent;
