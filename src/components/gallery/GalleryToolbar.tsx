import { useI18n } from "@/i18n/context";
import {
  GALLERY_FILTERS,
  GALLERY_SORTS,
  type GalleryFilter,
  type GallerySort,
} from "@/lib/gallery-view";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  filter: GalleryFilter;
  sort: GallerySort;
  onFilter: (value: GalleryFilter) => void;
  onSort: (value: GallerySort) => void;
}

/** Filter pills + sort select, styled to match the Dashboard media toolbar. */
const GalleryToolbar = ({ filter, sort, onFilter, onSort }: Props) => {
  const { t } = useI18n();

  const filterLabel: Record<GalleryFilter, string> = {
    all: t.gallery.filterAll,
    photo: t.gallery.filterPhotos,
    video: t.gallery.filterVideos,
  };
  const sortLabel: Record<GallerySort, string> = {
    manual: t.gallery.sortManual,
    newest: t.gallery.sortNewest,
    oldest: t.gallery.sortOldest,
    popular: t.gallery.sortPopular,
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
      <div
        role="group"
        aria-label={t.gallery.filterLabel}
        className="inline-flex flex-wrap items-center gap-1 p-1 rounded-full bg-card border border-border"
      >
        {GALLERY_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onFilter(value)}
            aria-pressed={filter === value}
            data-testid={`gallery-filter-${value}`}
            className={`px-4 py-2 text-sm font-body rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              filter === value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {filterLabel[value]}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm font-body text-muted-foreground">
        <span>{t.gallery.sortLabel}</span>
        <Select value={sort} onValueChange={(v) => onSort(v as GallerySort)}>
          <SelectTrigger className="w-[190px]" aria-label={t.gallery.sortLabel} data-testid="gallery-sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GALLERY_SORTS.map((value) => (
              <SelectItem key={value} value={value}>
                {sortLabel[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
    </div>
  );
};

export default GalleryToolbar;
