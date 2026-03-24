import { useState, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import ImageExt from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Plus, Bold, Italic, Heading2, List, LinkIcon, Save, Trash2, Pencil, Sparkles, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DashboardCard from "./DashboardCard";

interface BlogPost {
  id: string;
  title: string;
  content: string;
  seo_keywords: string[];
  meta_description: string;
  status: string;
  created_at: string;
}

const suggestedKeywords = [
  "masaje Valencia", "masajista Valencia centro", "masaje descontracturante",
  "masaje relajante Valencia", "terapia manual Valencia", "dolor de espalda masaje",
  "masaje deportivo Valencia", "bienestar Valencia", "masaje cerca de mí",
];

const DashboardBlog = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<BlogPost | null>(null);

  const fetchPosts = async () => {
    const { data } = await supabase
      .from("blog_posts")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setPosts(data);
    setLoading(false);
  };

  useEffect(() => { fetchPosts(); }, []);

  const startNew = () => {
    const newPost: BlogPost = {
      id: "",
      title: "",
      content: "",
      seo_keywords: [],
      meta_description: "",
      status: "draft",
      created_at: new Date().toISOString(),
    };
    setDraft(newPost);
    setEditing("new");
  };

  const startEdit = (p: BlogPost) => {
    setDraft({ ...p });
    setEditing(p.id);
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    if (editing === "new") {
      await supabase.from("blog_posts").insert({
        title: draft.title,
        content: draft.content,
        seo_keywords: draft.seo_keywords,
        meta_description: draft.meta_description,
        status: draft.status,
      });
    } else if (editing) {
      await supabase.from("blog_posts").update({
        title: draft.title,
        content: draft.content,
        seo_keywords: draft.seo_keywords,
        meta_description: draft.meta_description,
        status: draft.status,
      }).eq("id", editing);
    }
    setEditing(null);
    setDraft(null);
    setSaving(false);
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
    setDraft({
      ...draft,
      seo_keywords: has ? draft.seo_keywords.filter((k) => k !== kw) : [...draft.seo_keywords, kw],
    });
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={24} /></div>;

  if (editing && draft) {
    return <BlogEditor
      draft={draft}
      setDraft={setDraft}
      onSave={save}
      onCancel={() => { setEditing(null); setDraft(null); }}
      onGenerateMeta={generateMeta}
      suggestedKeywords={suggestedKeywords}
      onToggleKeyword={toggleKeyword}
      saving={saving}
    />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{posts.length} posts</p>
        <button
          onClick={startNew}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Plus size={14} /> New post
        </button>
      </div>

      {posts.map((p) => (
        <DashboardCard key={p.id}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium text-gray-900">{p.title}</h4>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  p.status === "published" ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"
                }`}>
                  {p.status}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{p.meta_description}</p>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {p.seo_keywords.map((kw) => (
                  <span key={kw} className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded">{kw}</span>
                ))}
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => startEdit(p)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50">
                <Pencil size={14} />
              </button>
              <button onClick={() => remove(p.id)} className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-50">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </DashboardCard>
      ))}
    </div>
  );
};

const BlogEditor = ({
  draft, setDraft, onSave, onCancel, onGenerateMeta, suggestedKeywords, onToggleKeyword, saving,
}: {
  draft: BlogPost;
  setDraft: (d: BlogPost) => void;
  onSave: () => void;
  onCancel: () => void;
  onGenerateMeta: () => void;
  suggestedKeywords: string[];
  onToggleKeyword: (kw: string) => void;
  saving: boolean;
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      ImageExt,
      Placeholder.configure({ placeholder: "Start writing your post…" }),
    ],
    content: draft.content,
    onUpdate: ({ editor }) => {
      setDraft({ ...draft, content: editor.getHTML() });
    },
  });

  return (
    <div className="space-y-4">
      <button onClick={onCancel} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600">
        <X size={14} /> Back to posts
      </button>

      <DashboardCard title="Post content">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Title</label>
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
              placeholder="Post title"
            />
          </div>

          {editor && (
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Content</label>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex gap-0.5 p-2 border-b border-gray-100 bg-gray-50">
                  <button onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1.5 rounded ${editor.isActive("bold") ? "bg-gray-200" : "hover:bg-gray-100"}`}><Bold size={14} /></button>
                  <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1.5 rounded ${editor.isActive("italic") ? "bg-gray-200" : "hover:bg-gray-100"}`}><Italic size={14} /></button>
                  <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`p-1.5 rounded ${editor.isActive("heading") ? "bg-gray-200" : "hover:bg-gray-100"}`}><Heading2 size={14} /></button>
                  <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`p-1.5 rounded ${editor.isActive("bulletList") ? "bg-gray-200" : "hover:bg-gray-100"}`}><List size={14} /></button>
                  <button onClick={() => { const url = window.prompt("URL:"); if (url) editor.chain().focus().setLink({ href: url }).run(); }} className={`p-1.5 rounded ${editor.isActive("link") ? "bg-gray-200" : "hover:bg-gray-100"}`}><LinkIcon size={14} /></button>
                </div>
                <EditorContent editor={editor} className="prose prose-sm max-w-none p-4 min-h-[200px] focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[180px]" />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <select
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value })}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
        </div>
      </DashboardCard>

      <DashboardCard title="SEO Keywords" description="Click to add keywords to this post">
        <div className="flex flex-wrap gap-2">
          {suggestedKeywords.map((kw) => (
            <button
              key={kw}
              onClick={() => onToggleKeyword(kw)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                draft.seo_keywords.includes(kw)
                  ? "bg-gray-900 text-white border-gray-900"
                  : "border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              {kw}
            </button>
          ))}
        </div>
      </DashboardCard>

      <DashboardCard title="Meta Description" description="Auto-generated or manually edit">
        <div className="space-y-3">
          <textarea
            value={draft.meta_description}
            onChange={(e) => setDraft({ ...draft, meta_description: e.target.value })}
            rows={2}
            maxLength={160}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none"
            placeholder="Meta description for search engines..."
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">{draft.meta_description.length}/160</span>
            <button
              onClick={onGenerateMeta}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50"
            >
              <Sparkles size={12} /> Auto-generate
            </button>
          </div>
        </div>
      </DashboardCard>

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-50">
          Cancel
        </button>
        <button onClick={onSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save post
        </button>
      </div>
    </div>
  );
};

export default DashboardBlog;
