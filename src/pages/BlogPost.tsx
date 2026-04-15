import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n/context";
import { useLocalePath } from "@/hooks/use-locale-path";
import { Calendar, ChevronLeft, Loader2 } from "lucide-react";
import { useHead } from "@/hooks/use-head";
import { BASE_URL, ROUTE_MAP, getAlternates } from "@/config/routes";

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
  const lp = useLocalePath();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!slug) return;

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
    const val = (p[key] as string) || "";
    const esFallback = (p[field as keyof Post] as string) || "";

    if (field === "content" && val.length > 0 && val.length < 500) {
      const candidates = [p.content || "", p.content_en || "", p.content_ru || ""];
      const longest = candidates.reduce((a, b) => (a.length >= b.length ? a : b), "");
      if (longest.length > val.length * 3) return longest;
    }

    return val || esFallback;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(
      locale === "es" ? "es-ES" : locale === "ru" ? "ru-RU" : "en-US",
      { year: "numeric", month: "long", day: "numeric" }
    );
  };

  const title = post ? getField(post, "title") : "";
  const content = post ? getField(post, "content") : "";
  const metaDesc = post ? getField(post, "meta_description") : "";
  const postSlug = post ? (post.slug || post.id) : "";
  const postUrl = post ? `${BASE_URL}${ROUTE_MAP.blog[locale]}/${postSlug}` : "";

  const jsonLd = post ? {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    description: metaDesc,
    datePublished: post.published_at,
    dateModified: post.published_at,
    author: { "@type": "Person", name: "Elias Masaje" },
    publisher: {
      "@type": "Organization",
      name: "Elias Masaje",
      url: BASE_URL,
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": postUrl },
    inLanguage: locale === "es" ? "es-ES" : locale === "ru" ? "ru-RU" : "en-US",
    ...((() => {
      const kws = locale === "en" ? post.seo_keywords_en : locale === "ru" ? post.seo_keywords_ru : post.seo_keywords;
      return kws?.length ? { keywords: kws.join(", ") } : {};
    })()),
  } : undefined;

  useHead({
    title: post ? `${title} | Elias Masaje` : undefined,
    description: metaDesc || undefined,
    canonical: postUrl || undefined,
    ogTitle: title || undefined,
    ogDescription: metaDesc || undefined,
    ogType: post ? "article" : undefined,
    alternates: postSlug ? getAlternates("blogPost", { slug: postSlug }) : undefined,
    jsonLd,
  });

  if (loading) {
    return (
      <div className="section-padding flex justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="section-padding pt-32 md:pt-36 text-center">
        <p className="text-muted-foreground mb-4">
          {locale === "es" ? "Artículo no encontrado." : locale === "ru" ? "Статья не найдена." : "Article not found."}
        </p>
        <Link to={lp("blog")} className="text-sm text-primary hover:underline">
          ← {locale === "es" ? "Volver al blog" : locale === "ru" ? "Назад к блогу" : "Back to blog"}
        </Link>
      </div>
    );
  }

  return (
    <article className="section-padding pt-32 md:pt-36">
      <div className="container-narrow">
        <Link
          to={lp("blog")}
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
