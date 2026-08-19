import { formatFileSize } from "@/lib/image-utils";
import { kindOf, extOf } from "@/lib/media-kind";
import type { LibraryFile } from "@/lib/media-filters";
import type { GridSize } from "@/lib/media-view-storage";
import MediaThumb from "./MediaThumb";
import MediaActions, { type MediaActionHandlers } from "./MediaActions";
import type { LibraryT } from "./i18n";

/** Column counts per tile size — responsive on mobile / tablet / desktop. */
const COLS: Record<GridSize, string> = {
  s: "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8",
  m: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5",
  l: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4",
};

interface Props extends MediaActionHandlers {
  files: LibraryFile[];
  size: GridSize;
  usage: Record<string, number> | null;
  L: LibraryT;
}

const MediaGrid = ({ files, size, usage, L, ...handlers }: Props) => (
  <div className={`grid gap-3 ${COLS[size]}`} data-testid="media-grid" data-size={size}>
    {files.map((f) => {
      const refs = usage?.[f.name];
      const kind = kindOf(f);
      return (
        <div
          key={f.name}
          className="group relative rounded-xl border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-ring"
        >
          <div className="relative">
            <MediaThumb file={f} className="w-full aspect-square rounded-none" iconSize={22} />
            {/* Hover on pointer devices, focus-within for keyboard, always visible on touch. */}
            <div className="absolute inset-x-0 bottom-0 bg-background/85 backdrop-blur-sm border-t border-border p-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity">
              <MediaActions file={f} L={L} variant="bar" {...handlers} />
            </div>
          </div>
          <div className="p-2">
            <p className="text-xs text-foreground truncate" title={f.name}>{f.name}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {formatFileSize(f.size)} · {extOf(f.name).toUpperCase() || L(kind === "video" ? "videos" : "other")}
              {refs !== undefined && <> · {refs > 0 ? L("used") : L("unused")}</>}
            </p>
          </div>
        </div>
      );
    })}
  </div>
);

export default MediaGrid;
