import { useMemo, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { useI18n } from "@/i18n/context";
import { useHead } from "@/hooks/use-head";
import { BASE_URL, ROUTE_MAP, getAlternates } from "@/config/routes";
import { buildLocalBusiness } from "@/lib/local-business";
import { buildBreadcrumbList } from "@/lib/breadcrumbs";
import { useGallery } from "@/hooks/use-gallery";
import { buildGallerySchema, originalFor, pickLocalized, thumbnailFor } from "@/lib/gallery";
import CropThumb from "@/components/gallery/CropThumb";
import GalleryLightbox from "@/components/gallery/GalleryLightbox";
import GalleryToolbar from "@/components/gallery/GalleryToolbar";
import LikeButton from "@/components/gallery/LikeButton";
import {
  DEFAULT_FILTER, DEFAULT_SORT, filterAndSortGallery,
  type GalleryFilter, type GallerySort,
} from "@/lib/gallery-view";
import { registerGalleryView } from "@/lib/gallery-engagement";


const GaleriaPage = () => {
  const { t, locale } = useI18n();
  const { data: allItems = [], isPending } = useGallery();
  const [filter, setFilter] = useState<GalleryFilter>(DEFAULT_FILTER);
  const [sort, setSort] = useState<GallerySort>(DEFAULT_SORT);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // One list drives the grid and the lightbox, so navigation follows what is visible.
  const items = useMemo(() => filterAndSortGallery(allItems, filter, sort), [allItems, filter, sort]);

  /** A view is only counted on a real open, once per item per browser session. */
  const openItem = (index: number) => {
    setOpenIndex(index);
    const item = items[index];
    if (item) void registerGalleryView(item.id);
  };

  // Changing filter/sort must not leave the lightbox pointing at a different item.
  const changeFilter = (value: GalleryFilter) => { setOpenIndex(null); setFilter(value); };
  const changeSort = (value: GallerySort) => { setOpenIndex(null); setSort(value); };

  const url = `${BASE_URL}${ROUTE_MAP.gallery[locale]}`;

  useHead({
    title: t.gallery.metaTitle,
    description: t.gallery.metaDescription,
    canonical: url,
    ogUrl: url,
    ogTitle: t.gallery.metaTitle,
    ogDescription: t.gallery.metaDescription,
    ogType: "website",
    locale,
    alternates: getAlternates("gallery"),
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        buildLocalBusiness(locale),
        buildBreadcrumbList("gallery", locale),
        buildGallerySchema(allItems, locale),
      ],
    },
  });

  return (
    <div className="section-padding pt-32 md:pt-36">
      <div className="container-wide">
        <h1 className="text-3xl md:text-4xl font-display text-foreground mb-3">{t.gallery.title}</h1>
        <p className="text-muted-foreground font-body mb-12 max-w-xl">{t.gallery.subtitle}</p>

        {allItems.length > 0 && (
          <GalleryToolbar filter={filter} sort={sort} onFilter={changeFilter} onSort={changeSort} />
        )}

        {isPending ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-muted-foreground" size={24} />
          </div>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground font-body py-12">
            {allItems.length === 0 ? t.gallery.empty : t.gallery.emptyFiltered}
          </p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 list-none p-0">
            {items.map((item, i) => {
              const title = pickLocalized(item, "title", locale);
              const description = pickLocalized(item, "description", locale);
              const alt = pickLocalized(item, "alt", locale) || title || t.gallery.title;
              const thumb = thumbnailFor(item);
              const fullSize = originalFor(item);
              const isVideo = item.media_type === "video";
              return (
                <li key={item.id} className="group">
                  <button
                    type="button"
                    data-testid={isVideo ? "gallery-video-thumb" : "gallery-photo-thumb"}
                    onClick={() => openItem(i)}
                    aria-label={isVideo ? `${t.gallery.playVideo}${title ? `: ${title}` : ""}` : title || alt}
                    className="w-full block relative overflow-hidden rounded-2xl bg-card border border-border transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <div className="relative w-full overflow-hidden" style={{ aspectRatio: "4 / 3" }}>
                      {thumb ? (
                        // Hover zoom lives on the wrapper so the saved crop transform
                        // on the <img> is never overwritten (crop + hover coexist).
                        <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.03]">
                          <CropThumb
                            src={thumb}
                            alt={alt}
                            crop={item}
                            loading="lazy"
                            decoding="async"
                            width={800}
                            height={600}
                            fullSrc={fullSize}
                            testId="gallery-grid-img"
                            onError={(e) => {
                              // If the storage transform ever fails, fall back to the
                              // untouched object rather than showing a broken tile.
                              const el = e.currentTarget;
                              if (fullSize && el.src !== fullSize) el.src = fullSize;
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-full h-full bg-secondary" aria-hidden="true" />
                      )}

                      {isVideo && (
                        <span
                          aria-hidden="true"
                          className="absolute inset-0 flex items-center justify-center"
                        >
                          <span className="flex items-center justify-center w-14 h-14 rounded-full bg-background/80 backdrop-blur-sm border border-border shadow-sm">
                            <Play size={22} className="text-foreground translate-x-[1px]" />
                          </span>
                        </span>
                      )}
                    </div>
                  </button>

                  <div className="px-1 pt-3">
                    {title && <h2 className="font-body text-sm text-foreground mb-1">{title}</h2>}
                    {description && (
                      <p className="text-sm text-muted-foreground font-body whitespace-pre-line line-clamp-3">
                        {description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 -ml-2">
                      <LikeButton itemId={item.id} count={item.like_count ?? 0} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {openIndex !== null && items[openIndex] && (
        <GalleryLightbox
          items={items}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onNavigate={openItem}
        />
      )}
    </div>
  );
};

export default GaleriaPage;
