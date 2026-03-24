import { useState, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import ImageExt from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Plus, Bold, Italic, Heading2, List, LinkIcon, Save, Trash2, Pencil, Sparkles, X, Loader2, Wand2, Lightbulb, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DashboardCard from "./DashboardCard";
import LanguageTabs, { Lang, langKey, langVal } from "./LanguageTabs";
import { toast } from "sonner";

interface BlogPost {
  id: string;
  title: string;
  content: string;
  seo_keywords: string[];
  meta_description: string;
  status: string;
  created_at: string;
  title_en: string;
  title_ru: string;
  content_en: string;
  content_ru: string;
  meta_description_en: string;
  meta_description_ru: string;
  hidden: boolean;
}

const suggestedKeywords = [
  "masaje Valencia", "masajista Valencia centro", "masaje descontracturante",
  "masaje relajante Valencia", "terapia manual Valencia", "dolor de espalda masaje",
  "masaje deportivo Valencia", "bienestar Valencia", "masaje cerca de mí",
];

/* ─── AI Generation Panel ─── */
interface TopicSuggestion { title: string; reason: string; }

const AIGeneratePanel = ({ onGenerated, lang }: {
  onGenerated: (post: { title: string; content: string; meta_description: string; keywords: string[] }) => void;
  lang: Lang;
}) => {
  const [step, setStep] = useState<"idle" | "suggesting" | "topics" | "custom" | "generating">("idle");
  const [topics, setTopics] = useState<TopicSuggestion[]>([]);
  const [customTopic, setCustomTopic] = useState("");

  const suggestTopics = async () => {
    setStep("suggesting");
    try {
      const { data, error } = await supabase.functions.invoke("blog-generator", {
        body: { action: "suggest_topics", language: lang },
      });
      if (error) throw error;
      const result = data?.result;
      if (Array.isArray(result)) {
        setTopics(result);
        setStep("topics");
      } else {
        throw new Error("Unexpected response format");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to get topic suggestions");
      setStep("idle");
    }
  };

  const generatePost = async (topic: string) => {
    setStep("generating");
    try {
      const { data, error } = await supabase.functions.invoke("blog-generator", {
        body: { action: "generate_post", topic, language: lang },
      });
      if (error) throw error;
      const result = data?.result;
      if (result && typeof result === "object" && result.title) {
        onGenerated(result);
        toast.success("Post generated — review and edit before saving");
        setStep("idle");
      } else {
        throw new Error("Unexpected response format");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to generate post");
      setStep("idle");
    }
  };

  if (step === "idle") {
    return (
      <DashboardCard>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex-1">
            <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Wand2 size={14} className="text-primary" /> Generate with AI
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Get SEO-optimized topic suggestions or enter your own theme
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={suggestTopics}
              className="flex items-center gap-1.5 px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted transition-colors"
            >
              <Lightbulb size={12} /> Suggest topics
            </button>
            <button
              onClick={() => setStep("custom")}
              className="flex items-center gap-1.5 px-3 py-2 text-xs bg-foreground text-background rounded-lg hover:opacity-90 transition-colors"
            >
              <Sparkles size={12} /> Write about…
            </button>
          </div>
        </div>
      </DashboardCard>
    );
  }

  if (step === "suggesting" || step === "generating") {
    return (
      <DashboardCard>
        <div className="flex items-center justify-center gap-3 py-8">
          <Loader2 size={18} className="animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {step === "suggesting" ? "Finding trending topics…" : "Writing your post…"}
          </p>
        </div>
      </DashboardCard>
    );
  }

  if (step === "topics") {
    return (
      <DashboardCard title="Topic Suggestions" description="Click a topic to generate a full post, or enter your own">
        <div className="space-y-2">
          {topics.map((t, i) => (
            <button
              key={i}
              onClick={() => generatePost(t.title)}
              className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted transition-colors group"
            >
              <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{t.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t.reason}</p>
            </button>
          ))}
          <div className="flex gap-2 mt-3 pt-3 border-t border-border">
            <input
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              placeholder="Or type your own topic…"
              className="flex-1 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              onKeyDown={(e) => { if (e.key === "Enter" && customTopic.trim()) generatePost(customTopic); }}
            />
            <button
              onClick={() => customTopic.trim() && generatePost(customTopic)}
              disabled={!customTopic.trim()}
              className="px-4 py-2 text-sm bg-foreground text-background rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              Generate
            </button>
          </div>
          <button onClick={() => setStep("idle")} className="text-xs text-muted-foreground hover:text-foreground mt-1">
            ← Back
          </button>
        </div>
      </DashboardCard>
    );
  }

  if (step === "custom") {
    return (
      <DashboardCard title="Write about…" description="Enter a topic or theme for your blog post">
        <div className="space-y-3">
          <input
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value)}
            placeholder="e.g. Benefits of deep tissue massage for office workers"
            className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter" && customTopic.trim()) generatePost(customTopic); }}
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setStep("idle"); setCustomTopic(""); }} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
              Cancel
            </button>
            <button
              onClick={() => customTopic.trim() && generatePost(customTopic)}
              disabled={!customTopic.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-foreground text-background rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              <Sparkles size={12} /> Generate post
            </button>
          </div>
        </div>
      </DashboardCard>
    );
  }

  return null;
};

/* ─── Main Component ─── */
const DashboardBlog = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<BlogPost | null>(null);
  const [lang, setLang] = useState<Lang>("es");

  const fetchPosts = async () => {
    const { data } = await supabase.from("blog_posts").select("*").order("created_at", { ascending: false });
    if (data) setPosts(data as BlogPost[]);
    setLoading(false);
  };

  useEffect(() => { fetchPosts(); }, []);

  const startNew = () => {
    const newPost: BlogPost = {
      id: "", title: "", content: "", seo_keywords: [], meta_description: "",
      status: "draft", created_at: new Date().toISOString(),
      title_en: "", title_ru: "", content_en: "", content_ru: "",
      meta_description_en: "", meta_description_ru: "", hidden: false,
    };
    setDraft(newPost); setEditing("new");
  };

  const startEdit = (p: BlogPost) => { setDraft({ ...p }); setEditing(p.id); };

  const handleAIGenerated = (result: { title: string; content: string; meta_description: string; keywords: string[] }) => {
    const titleKey = langKey("title", lang) as keyof BlogPost;
    const contentKey = langKey("content", lang) as keyof BlogPost;
    const metaKey = langKey("meta_description", lang) as keyof BlogPost;

    const newPost: BlogPost = {
      id: "", title: "", content: "", seo_keywords: result.keywords || [], meta_description: "",
      status: "draft", created_at: new Date().toISOString(),
      title_en: "", title_ru: "", content_en: "", content_ru: "",
      meta_description_en: "", meta_description_ru: "",
      [titleKey]: result.title,
      [contentKey]: result.content,
      [metaKey]: result.meta_description,
    };
    setDraft(newPost);
    setEditing("new");
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const payload = {
      title: draft.title, content: draft.content,
      seo_keywords: draft.seo_keywords, meta_description: draft.meta_description,
      status: draft.status,
      title_en: draft.title_en, title_ru: draft.title_ru,
      content_en: draft.content_en, content_ru: draft.content_ru,
      meta_description_en: draft.meta_description_en, meta_description_ru: draft.meta_description_ru,
    };
    if (editing === "new") {
      await supabase.from("blog_posts").insert(payload);
    } else if (editing) {
      await supabase.from("blog_posts").update(payload).eq("id", editing);
    }
    setEditing(null); setDraft(null); setSaving(false);
    fetchPosts();
  };

  const remove = async (id: string) => {
    await supabase.from("blog_posts").delete().eq("id", id);
    fetchPosts();
  };

  const generateMeta = () => {
    if (!draft) return;
    const title = draft.title || "masaje profesional";
    setDraft({
      ...draft,
      meta_description: `${title} en el centro de Valencia. Reserva tu sesión y descubre los beneficios del masaje terapéutico personalizado.`.slice(0, 160),
    });
  };

  const toggleKeyword = (kw: string) => {
    if (!draft) return;
    const has = draft.seo_keywords.includes(kw);
    setDraft({ ...draft, seo_keywords: has ? draft.seo_keywords.filter((k) => k !== kw) : [...draft.seo_keywords, kw] });
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" size={24} /></div>;

  if (editing && draft) {
    return <BlogEditor
      draft={draft} setDraft={setDraft} onSave={save}
      onCancel={() => { setEditing(null); setDraft(null); }}
      onGenerateMeta={generateMeta} suggestedKeywords={suggestedKeywords}
      onToggleKeyword={toggleKeyword} saving={saving}
      lang={lang} setLang={setLang}
    />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">{posts.length} posts</p>
          <LanguageTabs active={lang} onChange={setLang} />
        </div>
        <button onClick={startNew} className="flex items-center gap-2 px-4 py-2 bg-foreground text-background text-sm rounded-lg hover:opacity-90 transition-colors">
          <Plus size={14} /> Write a custom post
        </button>
      </div>

      <AIGeneratePanel onGenerated={handleAIGenerated} lang={lang} />

      {posts.map((p) => (
        <DashboardCard key={p.id}>
          <div className={`flex items-start justify-between gap-4 ${p.hidden ? "opacity-50" : ""}`}>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium text-foreground">{langVal(p, "title", lang) || p.title}</h4>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.status === "published" ? "bg-green-50 text-green-600" : "bg-muted text-muted-foreground"}`}>{p.status}</span>
                {p.hidden && <span className="text-[10px] px-2 py-0.5 bg-muted text-muted-foreground rounded-full">Hidden</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{langVal(p, "meta_description", lang) || p.meta_description}</p>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {p.seo_keywords.map((kw) => (
                  <span key={kw} className="text-[10px] px-2 py-0.5 bg-muted text-muted-foreground rounded">{kw}</span>
                ))}
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={async () => { await supabase.from("blog_posts").update({ hidden: !p.hidden }).eq("id", p.id); fetchPosts(); }} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted" title={p.hidden ? "Show on site" : "Hide from site"}>
                {p.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button onClick={() => startEdit(p)} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"><Pencil size={14} /></button>
              <button onClick={() => remove(p.id)} className="p-2 text-muted-foreground hover:text-destructive rounded-lg hover:bg-muted"><Trash2 size={14} /></button>
            </div>
          </div>
        </DashboardCard>
      ))}
    </div>
  );
};

/* ─── Blog Editor ─── */
const BlogEditor = ({
  draft, setDraft, onSave, onCancel, onGenerateMeta, suggestedKeywords, onToggleKeyword, saving, lang, setLang,
}: {
  draft: BlogPost;
  setDraft: (d: BlogPost) => void;
  onSave: () => void;
  onCancel: () => void;
  onGenerateMeta: () => void;
  suggestedKeywords: string[];
  onToggleKeyword: (kw: string) => void;
  saving: boolean;
  lang: Lang;
  setLang: (l: Lang) => void;
}) => {
  const titleKey = langKey("title", lang) as keyof BlogPost;
  const contentKey = langKey("content", lang) as keyof BlogPost;
  const metaKey = langKey("meta_description", lang) as keyof BlogPost;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      ImageExt,
      Placeholder.configure({ placeholder: "Start writing your post…" }),
    ],
    content: (draft[contentKey] as string) || "",
    onUpdate: ({ editor }) => {
      setDraft({ ...draft, [contentKey]: editor.getHTML() });
    },
  }, [lang]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onCancel} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><X size={14} /> Back to posts</button>
        <LanguageTabs active={lang} onChange={setLang} />
      </div>

      <DashboardCard title={`Post content (${lang.toUpperCase()})`}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Title ({lang.toUpperCase()})</label>
            <input
              value={(draft[titleKey] as string) || ""}
              onChange={(e) => setDraft({ ...draft, [titleKey]: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Post title"
            />
          </div>

          {editor && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Content ({lang.toUpperCase()})</label>
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="flex gap-0.5 p-2 border-b border-border bg-muted">
                  <button onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1.5 rounded ${editor.isActive("bold") ? "bg-background shadow-sm" : "hover:bg-background/50"}`}><Bold size={14} /></button>
                  <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1.5 rounded ${editor.isActive("italic") ? "bg-background shadow-sm" : "hover:bg-background/50"}`}><Italic size={14} /></button>
                  <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`p-1.5 rounded ${editor.isActive("heading") ? "bg-background shadow-sm" : "hover:bg-background/50"}`}><Heading2 size={14} /></button>
                  <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`p-1.5 rounded ${editor.isActive("bulletList") ? "bg-background shadow-sm" : "hover:bg-background/50"}`}><List size={14} /></button>
                  <button onClick={() => { const url = window.prompt("URL:"); if (url) editor.chain().focus().setLink({ href: url }).run(); }} className={`p-1.5 rounded ${editor.isActive("link") ? "bg-background shadow-sm" : "hover:bg-background/50"}`}><LinkIcon size={14} /></button>
                </div>
                <EditorContent editor={editor} className="prose prose-sm max-w-none p-4 min-h-[200px] focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[180px]" />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} className="px-3 py-2 text-sm border border-border rounded-lg focus:outline-none">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
        </div>
      </DashboardCard>

      <DashboardCard title="SEO Keywords" description="Click to add keywords to this post">
        <div className="flex flex-wrap gap-2">
          {suggestedKeywords.map((kw) => (
            <button key={kw} onClick={() => onToggleKeyword(kw)} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${draft.seo_keywords.includes(kw) ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground/30"}`}>
              {kw}
            </button>
          ))}
        </div>
      </DashboardCard>

      <DashboardCard title={`Meta Description (${lang.toUpperCase()})`} description="Auto-generated or manually edit">
        <div className="space-y-3">
          <textarea
            value={(draft[metaKey] as string) || ""}
            onChange={(e) => setDraft({ ...draft, [metaKey]: e.target.value })}
            rows={2} maxLength={160}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            placeholder="Meta description for search engines..."
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{((draft[metaKey] as string) || "").length}/160</span>
            {lang === "es" && (
              <button onClick={onGenerateMeta} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-muted">
                <Sparkles size={12} /> Auto-generate
              </button>
            )}
          </div>
        </div>
      </DashboardCard>

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted">Cancel</button>
        <button onClick={onSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-foreground text-background text-sm rounded-lg hover:opacity-90 disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save post
        </button>
      </div>
    </div>
  );
};

export default DashboardBlog;
