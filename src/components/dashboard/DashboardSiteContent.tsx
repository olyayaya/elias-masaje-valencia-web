import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import { isLocaleIndependentKey } from "@/lib/site-content-meta";
import { useIsMobile } from "@/hooks/use-mobile";
import DashboardCard from "./DashboardCard";
import LanguageTabs, { type Lang } from "./LanguageTabs";
import ImagePicker from "./ImagePicker";
import ImagePreviewEditor from "./ImagePreviewEditor";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Save, Loader2, Sparkles, ChevronRight, Search, Languages, ImageIcon, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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

const CATEGORIES: { id: string; label: string; pathHint?: string }[] = [
  { id: "contact", label: "Contact & Location" },
  { id: "hero", label: "Hero Section" },
  { id: "cta", label: "CTAs & Gift Card" },
  { id: "about", label: "About Preview (homepage)" },
  { id: "about_page", label: "About Me — full page", pathHint: "Controls the content shown on /sobre-mi" },
  { id: "footer", label: "Footer" },
  { id: "location", label: "Location" },
  { id: "reviews", label: "Reviews & Rating", pathHint: "Manually update the average rating and total review count shown on the homepage and in Google's structured data" },
  { id: "seo", label: "SEO & Crawlers" },
];

const langKey = (lang: Lang): "value_es" | "value_en" | "value_ru" =>
  lang === "es" ? "value_es" : lang === "en" ? "value_en" : "value_ru";

// Locale-independent fields (technical configs, URLs, ratings, handles,
// integration IDs) live in src/lib/site-content-meta.ts so the dashboard
// editor and the public-site hook agree on the same set.
const isLocaleIndependent = isLocaleIndependentKey;

const effectiveLangKey = (lang: Lang, key: string) =>
  isLocaleIndependent(key) ? "value_es" : langKey(lang);

const isLongField = (key: string) =>
  key.includes("description") || key.includes("tagline") || key.includes("preview_p") ||
  key === "robots_txt" || key === "sitemap_config" ||
  key === "about_bio" || key === "about_space_paragraphs";

const isMonoField = (key: string) => key === "robots_txt" || key === "sitemap_config";
const isJsonField = (key: string) => key === "sitemap_config";

const isImageField = (key: string) =>
  (key.includes("image") || key.includes("photo") || key.includes("logo") || key.includes("_img")) && !key.endsWith("_position");

const isPositionField = (key: string) => key.endsWith("_position");

/* ─── Category Section (extracted for open/closed state tracking) ─── */
const CategorySection = ({
  cat, catItems, allItems, lang, drafts, setDrafts, saveItem, saving, aiLoading,
  translateField, seoOptimize, hasChanged, setPickerOpen, isMobile,
}: {
  cat: { id: string; label: string; pathHint?: string };
  catItems: SiteContentRow[];
  allItems: SiteContentRow[];
  lang: Lang;
  drafts: Record<string, string>;
  setDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  saveItem: (item: SiteContentRow) => void;
  saving: string | null;
  aiLoading: string | null;
  translateField: (item: SiteContentRow) => void;
  seoOptimize: (item: SiteContentRow) => void;
  hasChanged: (item: SiteContentRow) => boolean;
  setPickerOpen: (id: string | null) => void;
  isMobile: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const visibleItems = catItems.filter((i) => !isPositionField(i.content_key));
  const verb = isMobile ? "tap" : "click";
  const hint = open
    ? `${visibleItems.length} fields — ${verb} to collapse`
    : `${visibleItems.length} fields — ${verb} to expand`;

  const findPositionItem = (imageKey: string) =>
    allItems.find((i) => i.content_key === `${imageKey}_position`);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full text-left">
        <DashboardCard title={cat.label} description={cat.pathHint || `Edit ${cat.label.toLowerCase()} text`}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
            <ChevronRight size={14} className={`transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
            <span>{hint}</span>
          </div>
        </DashboardCard>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border border-t-0 border-border rounded-b-lg bg-card px-5 pb-5 pt-3 space-y-4">
          {visibleItems.map((item) => {
            const posItem = isImageField(item.content_key) ? findPositionItem(item.content_key) : null;
            const localeIndep = isLocaleIndependent(item.content_key);
            const jsonField = isJsonField(item.content_key);
            let jsonError: string | null = null;
            if (jsonField) {
              const raw = drafts[item.id] ?? "";
              if (raw.trim()) {
                try {
                  const parsed = JSON.parse(raw);
                  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.extraUrls)) {
                    jsonError = "Must be an object with an `extraUrls` array";
                  } else {
                    const bad = parsed.extraUrls.findIndex(
                      (u: any) => !u || typeof u.loc !== "string" || !u.loc.startsWith("http")
                    );
                    if (bad !== -1) jsonError = `Entry #${bad + 1}: \`loc\` must be a full http(s) URL`;
                  }
                } catch (e: any) {
                  jsonError = `Invalid JSON: ${e.message}`;
                }
              }
            }

            // robots.txt linting (warnings, non-blocking)
            const robotsField = item.content_key === "robots_txt";
            const robotsWarnings: string[] = [];
            if (robotsField) {
              const raw = drafts[item.id] ?? "";
              if (raw.trim()) {
                const lines = raw.split(/\r?\n/);
                // Detect "Disallow: /" (exact root, ignoring trailing whitespace/comments)
                const blocksAll = lines.some((l) => /^\s*Disallow\s*:\s*\/\s*(#.*)?$/i.test(l));
                if (blocksAll) {
                  robotsWarnings.push("⚠️ A `Disallow: /` directive will block ALL crawlers from your entire site.");
                }
                // Sitemap directive present?
                const hasSitemap = lines.some((l) => /^\s*Sitemap\s*:\s*https?:\/\/\S+/i.test(l));
                if (!hasSitemap) {
                  robotsWarnings.push("⚠️ No `Sitemap:` directive found. Add `Sitemap: https://eliasmas.es/sitemap.xml` so crawlers can discover all pages.");
                }
                // At least one User-agent?
                const hasUserAgent = lines.some((l) => /^\s*User-agent\s*:\s*\S+/i.test(l));
                if (!hasUserAgent) {
                  robotsWarnings.push("⚠️ No `User-agent:` line found. robots.txt requires at least one user-agent block.");
                }
              }
            }

            return (
            <div key={item.id} className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                {item.label}
                {localeIndep && (
                  <span className="text-[10px] uppercase tracking-wide bg-secondary text-muted-foreground px-1.5 py-0.5 rounded">
                    Shared across languages
                  </span>
                )}
              </label>
              <div className="flex gap-2">
                <div className="flex-1">
                  {isImageField(item.content_key) ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={drafts[item.id] ?? ""}
                        onChange={(e) => setDrafts((p) => ({ ...p, [item.id]: e.target.value }))}
                        className="text-sm"
                        placeholder="Image URL..."
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPickerOpen(item.id)}
                        className="h-10 shrink-0"
                      >
                        <ImageIcon size={14} />
                      </Button>
                    </div>
                  ) : isLongField(item.content_key) ? (
                    <Textarea
                      value={drafts[item.id] ?? ""}
                      onChange={(e) => setDrafts((p) => ({ ...p, [item.id]: e.target.value }))}
                      rows={isMonoField(item.content_key) ? 12 : 3}
                      className={`text-sm ${isMonoField(item.content_key) ? "font-mono whitespace-pre" : ""}`}
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
                  {!localeIndep && (
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => seoOptimize(item)}
                            disabled={aiLoading === `seo-${item.id}`}
                            className="h-10"
                          >
                            {aiLoading === `seo-${item.id}` ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Search size={14} />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Improve for SEO</TooltipContent>
                      </Tooltip>
                      {lang !== "es" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => translateField(item)}
                              disabled={aiLoading === `translate-${item.id}`}
                              className="h-10"
                            >
                              {aiLoading === `translate-${item.id}` ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Languages size={14} />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Translate from Spanish</TooltipContent>
                        </Tooltip>
                      )}
                    </TooltipProvider>
                  )}
                  <Button
                    size="sm"
                    onClick={() => saveItem(item)}
                    disabled={saving === item.id || !hasChanged(item) || !!jsonError}
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
              {jsonError && (
                <p className="text-xs text-destructive font-mono">{jsonError}</p>
              )}
              {jsonField && !jsonError && (
                <p className="text-[11px] text-muted-foreground">
                  Format: {`{ "extraUrls": [{ "loc": "https://eliasmas.es/landing", "changefreq": "monthly", "priority": "0.5" }] }`}
                </p>
              )}
              {robotsField && robotsWarnings.length > 0 && (
                <ul className="space-y-1 pt-1 border-l-2 border-destructive/40 pl-3">
                  {robotsWarnings.map((w, i) => (
                    <li key={i} className="text-xs text-destructive/90">{w}</li>
                  ))}
                </ul>
              )}
              {/* Image preview + position editor */}
              {isImageField(item.content_key) && posItem && (drafts[item.id] ?? "").startsWith("http") && (
                <div className="space-y-2">
                  <ImagePreviewEditor
                    url={drafts[item.id] ?? ""}
                    position={drafts[posItem.id] ?? "center center"}
                    onPositionChange={(pos) => setDrafts((p) => ({ ...p, [posItem.id]: pos }))}
                  />
                  {drafts[posItem.id] !== posItem[langKey(lang)] && (
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => saveItem(posItem)}
                        disabled={saving === posItem.id}
                        className="text-xs"
                      >
                        {saving === posItem.id ? <Loader2 size={12} className="animate-spin mr-1" /> : <Save size={12} className="mr-1" />}
                        Save position
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

/* ─── Main Component ─── */
const DashboardSiteContent = () => {
  const [items, setItems] = useState<SiteContentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>("es");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  const fetchContent = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("site_content")
      .select("*")
      .order("sort_order", { ascending: true });
    if (data) {
      setItems(data as SiteContentRow[]);
      const d: Record<string, string> = {};
      data.forEach((r: any) => {
        d[r.id] = r[effectiveLangKey(lang, r.content_key)];
      });
      setDrafts(d);
    }
    setLoading(false);
  };

  useEffect(() => { fetchContent(); }, []);

  useEffect(() => {
    const d: Record<string, string> = {};
    items.forEach((r) => {
      d[r.id] = r[effectiveLangKey(lang, r.content_key)];
    });
    setDrafts(d);
  }, [lang, items]);

  const [pendingSave, setPendingSave] = useState<SiteContentRow | null>(null);

  const requestSave = (item: SiteContentRow) => setPendingSave(item);

  const confirmSave = async () => {
    const item = pendingSave;
    if (!item) return;
    setPendingSave(null);
    setSaving(item.id);
    const targetCol = effectiveLangKey(lang, item.content_key);
    const { error } = await supabase
      .from("site_content")
      .update({ [targetCol]: drafts[item.id] } as any)
      .eq("id", item.id);
    if (error) {
      toast.error("Failed to save");
    } else {
      toast.success(`${item.label} is now live`);
      setItems((prev) =>
        prev.map((r) => r.id === item.id ? { ...r, [targetCol]: drafts[item.id] } : r)
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.siteContent });
    }
    setSaving(null);
  };

  const translateField = async (item: SiteContentRow) => {
    if (lang === "es") return;
    setAiLoading(`translate-${item.id}`);
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
    setAiLoading(null);
  };

  const seoOptimize = async (item: SiteContentRow) => {
    const currentText = drafts[item.id] ?? "";
    if (!currentText.trim()) {
      toast.info("Enter some text first");
      return;
    }
    setAiLoading(`seo-${item.id}`);
    try {
      const { data, error } = await supabase.functions.invoke("ai-content-helper", {
        body: { text: currentText, action: "seo_optimize" },
      });
      if (error) throw error;
      if (data?.result) {
        setDrafts((prev) => ({ ...prev, [item.id]: data.result }));
        toast.success("SEO improvement ready — review and save");
      }
    } catch {
      toast.error("SEO optimization failed");
    }
    setAiLoading(null);
  };

  const hasChanged = (item: SiteContentRow) =>
    drafts[item.id] !== item[effectiveLangKey(lang, item.content_key)];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{items.length} editable fields</p>
        <LanguageTabs active={lang} onChange={setLang} />
      </div>

      {CATEGORIES.map((cat) => {
        const catItems = items.filter((i) => i.category === cat.id);
        if (!catItems.length) return null;
        return (
          <CategorySection
            key={cat.id} cat={cat} catItems={catItems} allItems={items} lang={lang}
            drafts={drafts} setDrafts={setDrafts} saveItem={requestSave}
            saving={saving} aiLoading={aiLoading} translateField={translateField}
            seoOptimize={seoOptimize} hasChanged={hasChanged}
            setPickerOpen={setPickerOpen} isMobile={isMobile}
          />
        );
      })}

      <ImagePicker
        open={!!pickerOpen}
        onClose={() => setPickerOpen(null)}
        onSelect={(url) => {
          if (pickerOpen) setDrafts((p) => ({ ...p, [pickerOpen]: url }));
        }}
        currentUrl={pickerOpen ? drafts[pickerOpen] : undefined}
      />

      <AlertDialog open={!!pendingSave} onOpenChange={(o) => !o && setPendingSave(null)}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Publish change to live site?</AlertDialogTitle>
            <AlertDialogDescription>
              This will go live immediately on eliasmas.es. Review the change below.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingSave && (() => {
            const col = effectiveLangKey(lang, pendingSave.content_key);
            const before = (pendingSave as any)[col] ?? "";
            const after = drafts[pendingSave.id] ?? "";
            return (
              <div className="space-y-3 my-2">
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{pendingSave.label}</span>
                  {!isLocaleIndependent(pendingSave.content_key) && (
                    <span className="ml-2 uppercase">· {lang}</span>
                  )}
                </div>
                <div className="grid md:grid-cols-[1fr_auto_1fr] gap-3 items-start">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Before</p>
                    <div className="bg-secondary rounded-lg p-3 text-sm whitespace-pre-wrap break-words max-h-48 overflow-auto">
                      {before || <span className="italic text-muted-foreground">empty</span>}
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-muted-foreground hidden md:block mt-9" />
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-primary">After (live)</p>
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm whitespace-pre-wrap break-words max-h-48 overflow-auto">
                      {after || <span className="italic text-muted-foreground">empty</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSave}>Publish to live site</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DashboardSiteContent;
