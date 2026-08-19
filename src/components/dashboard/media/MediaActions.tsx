import { Trash2, Loader2, FilePenLine, Pencil, Play } from "lucide-react";
import { kindOf } from "@/lib/media-kind";
import type { LibraryFile } from "@/lib/media-filters";

/**
 * The single source of truth for per-file actions. Both the list rows and the grid
 * cards render this component, so handlers, permissions (which action a kind allows)
 * and labels can never drift apart between the two views.
 */

export interface MediaActionHandlers {
  onPreview: (f: LibraryFile) => void;
  onEdit: (f: LibraryFile) => void;
  onRename: (f: LibraryFile) => void;
  onDelete: (f: LibraryFile) => void;
  /** Name currently being opened for edit (spinner). */
  opening?: string | null;
  /** Name currently being usage-checked before delete (spinner). */
  checking?: string | null;
}

interface Props extends MediaActionHandlers {
  file: LibraryFile;
  L: (k: string, vars?: Record<string, string | number>) => string;
  /** Grid cards use a compact, high-contrast bar over the thumbnail. */
  variant?: "row" | "bar";
}

const MediaActions = ({ file, L, variant = "row", onPreview, onEdit, onRename, onDelete, opening, checking }: Props) => {
  const kind = kindOf(file);
  const base =
    "p-2 rounded-lg disabled:opacity-50 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background";
  const btn =
    variant === "bar"
      ? `${base} text-foreground/90 hover:text-foreground hover:bg-background/70`
      : `${base} text-muted-foreground hover:text-foreground hover:bg-secondary`;

  return (
    <div className={variant === "bar" ? "flex items-center justify-center gap-1" : "flex items-center gap-1 ml-auto"}>
      {kind === "video" && (
        <button
          type="button"
          onClick={() => onPreview(file)}
          aria-label={`${L("preview")} ${file.name}`}
          title={L("preview")}
          className={btn}
        >
          <Play size={14} />
        </button>
      )}
      {kind !== "other" && (
        <button
          type="button"
          onClick={() => onEdit(file)}
          disabled={opening === file.name}
          aria-label={`${L("editReplace")} ${file.name}`}
          title={L("editReplace")}
          className={btn}
        >
          {opening === file.name ? <Loader2 size={14} className="animate-spin" /> : <FilePenLine size={14} />}
        </button>
      )}
      <button
        type="button"
        onClick={() => onRename(file)}
        aria-label={`${L("rename")} ${file.name}`}
        title={L("rename")}
        className={btn}
      >
        <Pencil size={14} />
      </button>
      <button
        type="button"
        onClick={() => onDelete(file)}
        disabled={checking === file.name}
        aria-label={`${L("del")} ${file.name}`}
        title={L("del")}
        className={`${btn} hover:text-destructive`}
      >
        {checking === file.name ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
      </button>
    </div>
  );
};

export default MediaActions;
