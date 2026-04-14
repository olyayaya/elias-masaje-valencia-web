import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n/context";
import { Calendar, ArrowRight, Loader2 } from "lucide-react";
import { useHead } from "@/hooks/use-head";

interface BlogPost {
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

const Blog = () => {
  const { locale } = useI18n();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("status", "published")
        .eq("hidden", false)
        .lte("published_at", new Date().toISOString())
        .order("published_at", { ascending: false });
      if (data) setPosts(data as unknown as BlogPost[]);
      setLoading(false);
    };
    load();
  }, []);

  const getField = (post: BlogPost, field: string): string => {
    const key = langField(field, locale) as keyof BlogPost;
    const val = post[key] as string;
    // Fallback to Spanish
    return val || (post[field as keyof BlogPost] as string) || "";
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(
      locale === "es" ? "es-ES" : locale === "ru" ? "ru-RU" : "en-US",
      { year: "numeric", month: "long", day: "numeric" }
    );
  };

  const stripHtml = (html: string) => {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  };

  const headings: Record<string, string> = {
    es: "Blog",
    en: "Blog",
    ru: "Блог",
  };

  const subtitles: Record<string, string> = {
    es: "Consejos y artículos sobre bienestar, relajación y cuidado corporal.",
    en: "Tips and articles on wellness, relaxation, and body care.",
    ru: "Советы и статьи о здоровье, расслаблении и уходе за телом.",
  };

  const title = locale === "es"
    ? "Blog — Elias Masaje Valencia"
    : locale === "ru"
    ? "Блог — Elias Masaje Валенсия"
    : "Blog — Elias Masaje Valencia";

  const desc = subtitles[locale];

  useHead({
    title,
    description: desc,
    canonical: "https://elias-masaje-valencia-web.lovable.app/blog",
    ogTitle: title,
    ogDescription: desc,
    ogType: "website",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": "https://elias-masaje-valencia-web.lovable.app/blog",
      name: headings[locale],
      description: desc,
      url: "https://elias-masaje-valencia-web.lovable.app/blog",
      isPartOf: { "@id": "https://elias-masaje-valencia-web.lovable.app/#website" },
      inLanguage: locale === "es" ? "es-ES" : locale === "ru" ? "ru-RU" : "en-US",
      ...(posts.length > 0 ? {
        mainEntity: {
          "@type": "ItemList",
          itemListElement: posts.map((post, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `https://elias-masaje-valencia-web.lovable.app/blog/${post.slug || post.id}`,
            name: getField(post, "title"),
          })),
        },
      } : {}),
    },
  });

  return (
    <div className="section-padding pt-32 md:pt-36">
      <div className="container-narrow">
        <h1 className="text-3xl md:text-4xl font-display text-foreground mb-3">
          {headings[locale]}
        </h1>
        <p className="text-muted-foreground mb-12 max-w-lg">
          {subtitles[locale]}
        </p>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-muted-foreground" size={24} />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">
              {locale === "es" ? "Próximamente nuevos artículos." : locale === "ru" ? "Скоро новые статьи." : "New articles coming soon."}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {posts.map((post) => {
              const title = getField(post, "title");
              const description = getField(post, "meta_description");
              const content = getField(post, "content");
              const preview = description || stripHtml(content).slice(0, 160) + "…";
              const slug = post.slug || post.id;

              return (
                <Link
                  key={post.id}
                  to={`/blog/${slug}`}
                  className="group block bg-card rounded-xl border border-border p-6 md:p-8 transition-all hover:border-muted-foreground/30 hover:shadow-soft"
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                    <Calendar size={12} />
                    <time dateTime={post.published_at}>{formatDate(post.published_at)}</time>
                  </div>
                  <h2 className="text-xl md:text-2xl font-display text-foreground mb-2 group-hover:text-primary transition-colors">
                    {title}
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-3">
                    {preview}
                  </p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-medium text-primary flex items-center gap-1 group-hover:gap-2 transition-all">
                      {locale === "es" ? "Leer más" : locale === "ru" ? "Читать далее" : "Read more"}
                      <ArrowRight size={12} />
                    </span>
                    {(locale === "en" ? post.seo_keywords_en : locale === "ru" ? post.seo_keywords_ru : post.seo_keywords)?.slice(0, 3).map((kw) => (
                      <span key={kw} className="text-[10px] px-2 py-0.5 bg-secondary text-muted-foreground rounded-full">
                        {kw}
                      </span>
                    ))}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Blog;
