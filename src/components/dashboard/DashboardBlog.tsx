import { useState, useEffect, useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import ImageExt from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import {
  Plus, Bold, Italic, Heading1, Heading2, Heading3,
  List, ListOrdered, LinkIcon, AlignLeft, AlignCenter, AlignRight,
  Save, Trash2, Pencil, Sparkles, X, Loader2, Wand2, Lightbulb,
  Eye, EyeOff, RotateCcw, ImageIcon, Languages,
} from "lucide-react";
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
  published_at: string | null;
  slug: string;
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

  const langLabel = lang === "es" ? "Spanish" : lang === "en" ? "English" : "Russian";

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
        toast.success(`Post generated in ${langLabel} — review and edit before saving`);
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
              Content will be generated natively in <strong>{langLabel}</strong>
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
            {step === "suggesting" ? "Finding trending topics…" : `Writing your post in ${langLabel}…`}
          </p>
        </div>
      </DashboardCard>
    );
  }

  if (step === "topics") {
    return (
      <DashboardCard title="Topic Suggestions" description={`Generated for ${langLabel} — click to generate a full post`}>
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
              className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
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
      <DashboardCard title="Write about…" description={`Post will be generated in ${langLabel}`}>
        <div className="space-y-3">
          <input
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value)}
            placeholder="e.g. Benefits of deep tissue massage for office workers"
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
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
      published_at: null, slug: "",
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
      meta_description_en: "", meta_description_ru: "", hidden: false,
      published_at: null, slug: "",
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
      slug: draft.slug,
      published_at: draft.status === "published" && !draft.published_at
        ? new Date().toISOString()
        : draft.published_at,
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
      suggestedKeywords={suggestedKeywords}
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
                {p.published_at && new Date(p.published_at) > new Date() && (
                  <span className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full">Scheduled</span>
                )}
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

/* ─── Toolbar Button ─── */
const ToolbarBtn = ({
  onClick,
  active = false,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`p-1.5 rounded transition-colors ${
      active ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
    }`}
  >
    {children}
  </button>
);

const ToolbarSep = () => <div className="w-px h-5 bg-border mx-0.5" />;

/* ─── Blog Editor ─── */
const BlogEditor = ({
  draft, setDraft, onSave, onCancel, suggestedKeywords, onToggleKeyword, saving, lang, setLang,
}: {
  draft: BlogPost;
  setDraft: (d: BlogPost) => void;
  onSave: () => void;
  onCancel: () => void;
  suggestedKeywords: string[];
  onToggleKeyword: (kw: string) => void;
  saving: boolean;
  lang: Lang;
  setLang: (l: Lang) => void;
}) => {
  const [regenerating, setRegenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const titleKey = langKey("title", lang) as keyof BlogPost;
  const contentKey = langKey("content", lang) as keyof BlogPost;
  const metaKey = langKey("meta_description", lang) as keyof BlogPost;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({ openOnClick: false }),
      ImageExt,
      Placeholder.configure({ placeholder: "Start writing your post…" }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: (draft[contentKey] as string) || "",
    onUpdate: ({ editor }) => {
      setDraft({ ...draftRef.current, [contentKey]: editor.getHTML() });
    },
  }, [lang]);

  const insertLink = useCallback(() => {
    if (!editor) return;
    const existingHref = editor.getAttributes("link").href;
    const url = window.prompt("URL:", existingHref || "https://");
    if (url === null) return; // cancelled
    if (url === "") {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url, target: "_blank" }).run();
    }
  }, [editor]);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `blog/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("media").upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
      editor.chain().focus().setImage({ src: urlData.publicUrl }).run();
      toast.success("Image inserted");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [editor]);

  const regenerateContent = async () => {
    const title = (draft[titleKey] as string) || "massage wellness";
    setRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("blog-generator", {
        body: { action: "regenerate_content", topic: title, language: lang },
      });
      if (error) throw error;
      const result = data?.result;
      if (result?.content) {
        setDraft({ ...draft, [contentKey]: result.content });
        editor?.commands.setContent(result.content, { emitUpdate: false });
        toast.success("Content regenerated");
      } else {
        throw new Error("Unexpected response");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to regenerate");
    } finally {
      setRegenerating(false);
    }
  };

  // Cross-language generation: find source content from another language
  const [translating, setTranslating] = useState(false);
  const allLangs: Lang[] = ["es", "en", "ru"];
  const langLabels: Record<Lang, string> = { es: "Spanish", en: "English", ru: "Russian" };
  const currentTitle = (draft[titleKey] as string) || "";
  const currentContent = (draft[contentKey] as string) || "";
  const currentIsEmpty = !currentTitle.trim() && !currentContent.trim();

  const sourceLang = currentIsEmpty
    ? allLangs.find((l) => {
        if (l === lang) return false;
        const tKey = langKey("title", l) as keyof BlogPost;
        const cKey = langKey("content", l) as keyof BlogPost;
        return !!((draft[tKey] as string)?.trim()) || !!((draft[cKey] as string)?.trim());
      })
    : undefined;

  const translateFromSource = async (srcLang: Lang) => {
    setTranslating(true);
    try {
      const srcTitleKey = langKey("title", srcLang) as keyof BlogPost;
      const srcContentKey = langKey("content", srcLang) as keyof BlogPost;
      const srcMetaKey = langKey("meta_description", srcLang) as keyof BlogPost;

      const { data, error } = await supabase.functions.invoke("blog-generator", {
        body: {
          action: "translate_post",
          language: lang,
          source_title: (draft[srcTitleKey] as string) || "",
          source_content: (draft[srcContentKey] as string) || "",
          source_meta: (draft[srcMetaKey] as string) || "",
        },
      });
      if (error) throw error;
      const result = data?.result;
      if (result?.title && result?.content) {
        setDraft({
          ...draft,
          [titleKey]: result.title,
          [contentKey]: result.content,
          [metaKey]: result.meta_description || "",
          seo_keywords: result.keywords?.length ? result.keywords : draft.seo_keywords,
        });
        editor?.commands.setContent(result.content, { emitUpdate: false });
        toast.success(`${langLabels[lang]} version generated from ${langLabels[srcLang]}`);
      } else {
        throw new Error("Unexpected response");
      }
    } catch (e: any) {
      toast.error(e.message || "Translation failed");
    } finally {
      setTranslating(false);
    }
  };

  const generateMeta = () => {
    if (!draft) return;
    const title = (draft[titleKey] as string) || "masaje profesional";
    const langSuffix = lang === "en"
      ? `in central Valencia. Book your session and discover the benefits of personalized therapeutic massage.`
      : lang === "ru"
      ? `в центре Валенсии. Запишитесь на сеанс и откройте для себя преимущества персонализированного массажа.`
      : `en el centro de Valencia. Reserva tu sesión y descubre los beneficios del masaje terapéutico personalizado.`;
    setDraft({
      ...draft,
      [metaKey]: `${title} ${langSuffix}`.slice(0, 160),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onCancel} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><X size={14} /> Back to posts</button>
        <LanguageTabs active={lang} onChange={setLang} />
      </div>

      {/* Cross-language generation banner */}
      {sourceLang && (
        <DashboardCard>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex-1">
              <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Languages size={14} className="text-primary" /> No {langLabels[lang]} content yet
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                This post has content in {langLabels[sourceLang]}. Generate the {langLabels[lang]} version automatically.
              </p>
            </div>
            <button
              onClick={() => translateFromSource(sourceLang)}
              disabled={translating}
              className="flex items-center gap-1.5 px-4 py-2 text-xs bg-foreground text-background rounded-lg hover:opacity-90 disabled:opacity-50 transition-colors"
            >
              {translating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Generate {lang.toUpperCase()} from {sourceLang.toUpperCase()}
            </button>
          </div>
        </DashboardCard>
      )}

      <DashboardCard title={`Post content (${lang.toUpperCase()})`}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Title ({lang.toUpperCase()})</label>
            <input
              value={(draft[titleKey] as string) || ""}
              onChange={(e) => setDraft({ ...draft, [titleKey]: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Post title"
            />
          </div>

          {editor && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Content ({lang.toUpperCase()})</label>
              <div className="border border-border rounded-lg overflow-hidden">
                {/* ── Toolbar ── */}
                <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-border bg-muted">
                  <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
                    <Bold size={14} />
                  </ToolbarBtn>
                  <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
                    <Italic size={14} />
                  </ToolbarBtn>

                  <ToolbarSep />

                  <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Heading 1">
                    <Heading1 size={14} />
                  </ToolbarBtn>
                  <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2">
                    <Heading2 size={14} />
                  </ToolbarBtn>
                  <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading 3">
                    <Heading3 size={14} />
                  </ToolbarBtn>

                  <ToolbarSep />

                  <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet list">
                    <List size={14} />
                  </ToolbarBtn>
                  <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered list">
                    <ListOrdered size={14} />
                  </ToolbarBtn>

                  <ToolbarSep />

                  <ToolbarBtn onClick={insertLink} active={editor.isActive("link")} title="Insert link">
                    <LinkIcon size={14} />
                  </ToolbarBtn>
                  <ToolbarBtn onClick={() => fileInputRef.current?.click()} active={false} title="Insert image">
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                  </ToolbarBtn>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />

                  <ToolbarSep />

                  <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Align left">
                    <AlignLeft size={14} />
                  </ToolbarBtn>
                  <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Align center">
                    <AlignCenter size={14} />
                  </ToolbarBtn>
                  <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Align right">
                    <AlignRight size={14} />
                  </ToolbarBtn>

                  <ToolbarSep />

                  <ToolbarBtn onClick={regenerateContent} active={false} title="Regenerate content with AI">
                    {regenerating ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                  </ToolbarBtn>
                </div>
                {/* ── Editor ── */}
                <EditorContent
                  editor={editor}
                  className="prose prose-sm max-w-none p-4 min-h-[240px] focus:outline-none
                    [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[220px]
                    prose-headings:font-display prose-p:text-foreground
                    prose-a:text-primary prose-a:underline
                    prose-ol:list-decimal prose-ul:list-disc
                    [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6
                    [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6
                    [&_.ProseMirror_li]:my-1
                    [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:h-auto [&_.ProseMirror_img]:rounded-lg [&_.ProseMirror_img]:my-4"
                />
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
                <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none">
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Publish date</label>
                <input
                  type="datetime-local"
                  value={draft.published_at ? new Date(draft.published_at).toISOString().slice(0, 16) : ""}
                  onChange={(e) => setDraft({ ...draft, published_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none"
                />
              </div>
            </div>
            {draft.published_at && new Date(draft.published_at) > new Date() && (
              <p className="text-xs text-primary">⏰ Scheduled — will go live {new Date(draft.published_at).toLocaleString()}</p>
            )}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">URL slug</label>
              <input
                value={draft.slug || ""}
                onChange={(e) => setDraft({ ...draft, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-") })}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none"
                placeholder="my-post-title"
              />
              <p className="text-[11px] text-muted-foreground mt-1">/blog/{draft.slug || "..."}</p>
            </div>
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
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            placeholder="Meta description for search engines..."
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{((draft[metaKey] as string) || "").length}/160</span>
            <button onClick={generateMeta} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-muted">
              <Sparkles size={12} /> Auto-generate
            </button>
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
