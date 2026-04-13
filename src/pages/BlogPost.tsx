import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n/context";
import { Calendar, ChevronLeft, Loader2 } from "lucide-react";

interface Post {
  id: string;
  title: string;
  content: string;
  meta_description: string;
  title_en: string;
  title_ru: string;
  content_en: string;
  content_ru: string;
  meta_description_en: string;
  meta_description_ru: string;
  slug: string;
  published_at: string;
  seo_keywords: string[];
  seo_keywords_en: string[];
  seo_keywords_ru: string[];
}

const langField = (field: string, locale: string) => {
  if (locale === "es") return field;
  return `${field}_${locale}`;
};

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const { locale } = useI18n();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!slug) return;

      // Try slug first, then id
      let { data } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .eq("status", "published")
        .eq("hidden", false)
        .lte("published_at", new Date().toISOString())
        .maybeSingle();

      if (!data) {
        const res = await supabase
          .from("blog_posts")
          .select("*")
          .eq("id", slug)
          .eq("status", "published")
          .eq("hidden", false)
          .lte("published_at", new Date().toISOString())
          .maybeSingle();
        data = res.data;
      }

      if (data) setPost(data as unknown as Post);
      setLoading(false);
    };
    load();
  }, [slug]);

  const getField = (p: Post, field: string): string => {
    const key = langField(field, locale) as keyof Post;
    const val = p[key] as string;
    return val || (p[field as keyof Post] as string) || "";
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(
      locale === "es" ? "es-ES" : locale === "ru" ? "ru-RU" : "en-US",
      { year: "numeric", month: "long", day: "numeric" }
    );
  };

  if (loading) {
    return (
      <div className="section-padding flex justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="section-padding text-center">
        <p className="text-muted-foreground mb-4">
          {locale === "es" ? "Artículo no encontrado." : locale === "ru" ? "Статья не найдена." : "Article not found."}
        </p>
        <Link to="/blog" className="text-sm text-primary hover:underline">
          ← {locale === "es" ? "Volver al blog" : locale === "ru" ? "Назад к блогу" : "Back to blog"}
        </Link>
      </div>
    );
  }

  const title = getField(post, "title");
  const content = getField(post, "content");
  const metaDesc = getField(post, "meta_description");

  return (
    <article className="section-padding">
      <div className="container-narrow">
        <Link
          to="/blog"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ChevronLeft size={14} />
          {locale === "es" ? "Blog" : locale === "ru" ? "Блог" : "Blog"}
        </Link>

        <header className="mb-10">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
            <Calendar size={12} />
            <time dateTime={post.published_at}>{formatDate(post.published_at)}</time>
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-display text-foreground leading-tight mb-4">
            {title}
          </h1>
          {metaDesc && (
            <p className="text-lg text-muted-foreground leading-relaxed">
              {metaDesc}
            </p>
          )}
        </header>

        <div
          className="prose prose-sm md:prose-base max-w-none text-foreground
            prose-headings:font-display prose-headings:text-foreground prose-headings:font-normal
            prose-p:text-muted-foreground prose-p:leading-relaxed
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            prose-strong:text-foreground
            prose-li:text-muted-foreground
            prose-blockquote:border-primary/30 prose-blockquote:text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: content }}
        />

        {(() => {
          const kws = locale === "en" ? post.seo_keywords_en : locale === "ru" ? post.seo_keywords_ru : post.seo_keywords;
          return kws && kws.length > 0 ? (
            <div className="flex flex-wrap gap-2 mt-12 pt-8 border-t border-border">
              {kws.map((kw) => (
                <span key={kw} className="text-xs px-3 py-1 bg-secondary text-muted-foreground rounded-full">
                  {kw}
                </span>
              ))}
            </div>
          ) : null;
        })()}
      </div>
    </article>
  );
};

export default BlogPost;
