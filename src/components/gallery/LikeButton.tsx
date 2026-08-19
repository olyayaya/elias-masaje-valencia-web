import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { useI18n } from "@/i18n/context";
import { isLiked, setLikedLocally, toggleGalleryLike } from "@/lib/gallery-engagement";

interface Props {
  itemId: string;
  /** Server-side count when the engagement columns are available. */
  count?: number;
}

/**
 * Anonymous heart. The visitor id lives in localStorage only (no cookies, no
 * fingerprinting), the UI is optimistic, and a rejected write rolls both the icon and
 * the counter back. Clicking never opens the lightbox behind it.
 */
const LikeButton = ({ itemId, count = 0 }: Props) => {
  const { t } = useI18n();
  const [liked, setLiked] = useState(false);
  const [total, setTotal] = useState(count);
  const [busy, setBusy] = useState(false);

  // Read after mount: localStorage is not available while rendering on the server.
  useEffect(() => setLiked(isLiked(itemId)), [itemId]);
  useEffect(() => setTotal(count), [count]);

  const label = liked ? t.gallery.unlike : t.gallery.like;

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;

    const next = !liked;
    const prevTotal = total;
    setLiked(next);
    setTotal(Math.max(0, prevTotal + (next ? 1 : -1)));
    setLikedLocally(itemId, next);
    setBusy(true);

    const res = await toggleGalleryLike(itemId, next);
    setBusy(false);
    if (!res.synced) {
      setLiked(!next);
      setTotal(prevTotal);
      setLikedLocally(itemId, !next);
      return;
    }
    if (typeof res.likeCount === "number") setTotal(res.likeCount);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={liked}
      aria-label={label}
      title={label}
      data-testid="gallery-like"
      className="inline-flex items-center gap-1.5 min-h-[44px] min-w-[44px] px-2 rounded-full text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Heart
        size={17}
        aria-hidden="true"
        className={liked ? "fill-current text-primary" : ""}
      />
      {total > 0 && (
        <span className="text-xs font-body tabular-nums" data-testid="gallery-like-count">
          {total}
        </span>
      )}
    </button>
  );
};

export default LikeButton;
