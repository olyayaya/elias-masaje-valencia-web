import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/i18n/context";
import { pickLocalized, type GalleryItem } from "@/lib/gallery";

interface Props {
  items: GalleryItem[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

const FOCUSABLE = 'button, [href], video, [tabindex]:not([tabindex="-1"])';

/**
 * Accessible full-screen viewer: focus trap, Esc / arrow keys, backdrop click and
 * touch swipes. The <video> element is unmounted on close, which guarantees playback
 * (and audio) stops — nothing keeps playing behind the closed dialog.
 */
const GalleryLightbox = ({ items, index, onClose, onNavigate }: Props) => {
  const { t, locale } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const touchX = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);

  const item = items[index];

  const go = useCallback(
    (delta: number) => {
      if (items.length < 2) return;
      onNavigate((index + delta + items.length) % items.length);
    },
    [index, items.length, onNavigate],
  );

  const stopVideo = useCallback(() => {
    const v = videoRef.current;
    if (v) {
      try {
        v.pause();
        v.currentTime = 0;
      } catch {
        /* jsdom / unsupported media — closing already unmounts the element */
      }
    }
  }, []);

  const close = useCallback(() => {
    stopVideo();
    onClose();
  }, [onClose, stopVideo]);

  useEffect(() => setMounted(true), []);

  // Remember what had focus before the dialog opened and hand it back on close, so
  // keyboard users land on the thumbnail they came from instead of the page top.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    return () => {
      if (opener && typeof opener.focus === "function" && document.contains(opener)) {
        opener.focus();
      }
    };
  }, []);

  // Stop playback whenever the visible item changes, not only on close. The element
  // is captured while the effect runs: by cleanup time the ref already points at the
  // next item (or null), so reading it there would silently skip the pause.
  useEffect(() => {
    const v = videoRef.current;
    return () => {
      if (!v) return;
      try {
        v.pause();
        v.currentTime = 0;
      } catch {
        /* jsdom / unsupported media */
      }
    };
  }, [index]);


  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      else if (e.key === "Tab") {
        const nodes = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
        if (!nodes?.length) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && (active === first || !panelRef.current?.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [close, go]);

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, [mounted]);

  if (!item) return null;

  const title = pickLocalized(item, "title", locale);
  const description = pickLocalized(item, "description", locale);
  const alt = pickLocalized(item, "alt", locale) || title;

  const body = (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-sm px-3 py-6"
      data-testid="gallery-lightbox"
      onClick={close}
      onTouchStart={(e) => { touchX.current = e.touches[0]?.clientX ?? null; }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX;
        touchX.current = null;
        if (start == null || end == null) return;
        const dx = end - start;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t.gallery.viewer}
        className="relative w-full max-w-5xl max-h-full overflow-y-auto rounded-2xl bg-card p-3 md:p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-end gap-1 mb-2">
          {items.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label={t.gallery.prev}
                className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label={t.gallery.next}
                className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={close}
            aria-label={t.gallery.close}
            className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="bg-background rounded-xl overflow-hidden flex items-center justify-center" style={{ aspectRatio: "4 / 3" }}>
          {item.media_type === "video" ? (
            <video
              ref={videoRef}
              src={item.media_url}
              poster={item.poster_url || undefined}
              controls
              playsInline
              preload="metadata"
              aria-label={title || t.gallery.playVideo}
              className="w-full h-full object-contain bg-black"
            />
          ) : (
            <img
              src={item.media_url}
              alt={alt}
              className="w-full h-full object-contain"
            />
          )}
        </div>

        {(title || description) && (
          <div className="pt-4 pb-1 px-1">
            {title && <h2 className="font-display text-lg text-foreground mb-1">{title}</h2>}
            {description && (
              <p className="text-sm text-muted-foreground font-body whitespace-pre-line">{description}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return body;
  return createPortal(body, document.body);
};

export default GalleryLightbox;
