import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Pause, Play } from "lucide-react";
import { useI18n } from "@/i18n/context";
import { usePublicReviews } from "@/hooks/use-reviews";
import {
  displayReviews,
  isSiteLocale,
  localizedReviewText,
  normalizeAuthorName,
  type Review,
} from "@/lib/reviews";

/* ------------------------------------------------------------------ *
 * Public reviews — real, manually imported reviews only.
 *
 * No provider branding, no source badges, no legacy fallback and no invented
 * card. When the storage is missing, still loading, failing, switched off or
 * empty after the owner's filters, the whole block (heading, divider, cards) is
 * simply absent from the page — never an error box or a skeleton.
 *
 * The row is a scroll-snap list with a gentle right-to-left autoplay the user
 * can stop; swipe, keyboard scrolling and the arrows keep working either way.
 * ------------------------------------------------------------------ */

const CLAMP_CHARS = 180;
/** Autoplay speed in CSS px per second — slow enough to read while it moves. */
const AUTOPLAY_PX_PER_SEC = 26;
/** How long autoplay stays out of the way after a manual arrow/swipe. */
const MANUAL_PAUSE_MS = 1200;

/** The public date always follows the page language, never the visitor's browser. */
const DATE_LOCALES = { es: "es-ES", en: "en-GB", ru: "ru-RU" } as const;

const Stars = ({ n, label }: { n: number; label: string }) => (
  <span className="flex gap-0.5" role="img" aria-label={label}>
    {Array.from({ length: 5 }).map((_, i) => (
      <span
        key={i}
        aria-hidden="true"
        className={`text-xs ${i < n ? "text-yellow-500" : "text-muted-foreground/30"}`}
      >
        ★
      </span>
    ))}
  </span>
);

const ReviewCard = ({ review, clone = false }: { review: Review; clone?: boolean }) => {
  const { t, locale } = useI18n();
  const [expanded, setExpanded] = useState(false);
  // The page language decides which stored text is shown; the original is the
  // fallback and is never overwritten.
  const siteLocale = isSiteLocale(locale) ? locale : "es";
  const { text } = localizedReviewText(review, siteLocale);
  const longText = text.length > CLAMP_CHARS;
  // Display-only: the stored name keeps its original characters.
  const authorName = normalizeAuthorName(review.author_name);

  return (
    <li
      className="snap-start shrink-0 w-[85vw] sm:w-[340px] bg-secondary/60 rounded-2xl border border-border/50 p-6"
      data-testid={clone ? "review-card-clone" : "review-card"}
      aria-hidden={clone || undefined}
    >
      {/* Name and date lead the card: one tidy row when they fit, the date
          moving down as a whole when they don't. */}
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
        <p className="min-w-0 flex-1 text-sm font-body font-medium not-italic">
          <cite
            className="not-italic block truncate whitespace-nowrap"
            title={authorName}
            data-testid={clone ? undefined : "review-author"}
          >
            {authorName}
          </cite>
        </p>
        {review.reviewed_at && (
          <span className="shrink-0 whitespace-nowrap text-[11px] font-body text-muted-foreground/70">
            {new Date(review.reviewed_at).toLocaleDateString(DATE_LOCALES[siteLocale])}
          </span>
        )}
      </header>

      <div className="mb-2">
        <Stars n={review.rating} label={t.testimonials.ratingAria.replace("{n}", String(review.rating))} />
      </div>

      <blockquote className="text-sm text-muted-foreground font-body leading-relaxed italic">
        <p className={`whitespace-pre-line ${!expanded && longText ? "line-clamp-4" : ""}`}>{text}</p>
      </blockquote>
      {longText && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs font-body underline underline-offset-2 text-foreground/80 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded"
        >
          {expanded ? t.testimonials.showLess : t.testimonials.readMore}
        </button>
      )}

      <footer className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        {review.original_url && (
          <a
            href={review.original_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-body text-muted-foreground/70 underline-offset-2 hover:underline hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded"
          >
            <ExternalLink size={11} aria-hidden="true" />
            {t.testimonials.openOriginal}
          </a>
        )}
      </footer>
    </li>
  );
};

const ReviewsSection = () => {
  const { t } = useI18n();
  const scroller = useRef<HTMLUListElement>(null);
  const { items, settings, missingTable, isPending, isError } = usePublicReviews();

  const [playing, setPlaying] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const hovering = useRef(false);
  const suspendUntil = useRef(0);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  const reviews = displayReviews(items, settings);
  const canAutoplay = !reducedMotion && reviews.length > 1;
  const running = playing && canAutoplay;
  // The duplicated half is part of the layout, not of the play state: it stays
  // mounted while paused so nothing reflows, jumps or resets scrollLeft.
  const duplicated = !reducedMotion && reviews.length > 1;

  // Continuous right-to-left drift. The list is rendered twice, so wrapping is a
  // silent subtraction of half the track — no jump, no snap-back. Only the
  // requestAnimationFrame loop starts and stops; the DOM never changes.
  useEffect(() => {
    if (!running) return;
    const el = scroller.current;
    if (!el || typeof requestAnimationFrame !== "function") return;
    let raf = 0;
    let last = performance.now();
    // Sub-pixel accumulator: writing rounded values every frame is what makes
    // the motion look stuttery at slow speeds.
    let pos = el.scrollLeft;
    const step = (now: number) => {
      const dt = Math.min(now - last, 100);
      last = now;
      if (!hovering.current && now >= suspendUntil.current) {
        // A manual scroll/swipe in between wins over the accumulator.
        if (Math.abs(el.scrollLeft - pos) > 2) pos = el.scrollLeft;
        const half = el.scrollWidth / 2;
        pos += (AUTOPLAY_PX_PER_SEC * dt) / 1000;
        if (half > 0 && pos >= half) pos -= half;
        el.scrollLeft = pos;
      } else {
        pos = el.scrollLeft;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [running]);


  const scrollBy = useCallback((dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    suspendUntil.current = (typeof performance !== "undefined" ? performance.now() : 0) + MANUAL_PAUSE_MS;
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.8, 260), behavior: "smooth" });
  }, []);

  // Nothing to show yet, or something went wrong → the section does not exist.
  // A marketing page never shows an error box where reviews should be.
  if (missingTable || isPending || isError) return null;
  // Section disabled, or nothing passes the owner's filters → render nothing.
  if (reviews.length === 0) return null;

  const btn =
    "inline-flex items-center justify-center h-11 w-11 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

  return (
    <section className="px-6 md:px-12 lg:px-20 py-20 md:py-28" data-testid="reviews-section">
      <div className="max-w-5xl mx-auto">
        <div ref={heading.ref} style={heading.style} className="text-center mb-8">
          <h2 className="font-display text-3xl md:text-4xl mb-2">{t.testimonials.title}</h2>
          <div className="w-12 h-px bg-primary mx-auto mt-3" />
        </div>

        <div className="relative">
          <ul
            ref={scroller}
            tabIndex={0}
            aria-label={t.testimonials.carouselLabel}
            data-testid="reviews-scroller"
            onMouseEnter={() => { hovering.current = true; }}
            onMouseLeave={() => { hovering.current = false; }}
            onPointerDown={() => { suspendUntil.current = (typeof performance !== "undefined" ? performance.now() : 0) + MANUAL_PAUSE_MS; }}
            className="no-scrollbar flex gap-5 overflow-x-auto pb-4 -mx-2 px-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-2xl"
          >
            {reviews.map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
            {duplicated && reviews.map((r) => <ReviewCard key={`clone-${r.id}`} review={r} clone />)}

          </ul>

          {reviews.length > 1 && (
            <div className="flex justify-center gap-3 mt-2">
              <button
                type="button"
                onClick={() => scrollBy(-1)}
                aria-label={t.testimonials.prev}
                title={t.testimonials.prev}
                className={btn}
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setPlaying((v) => !v)}
                aria-label={running ? t.testimonials.pause : t.testimonials.play}
                title={running ? t.testimonials.pause : t.testimonials.play}
                aria-pressed={!playing}
                data-testid="reviews-autoplay-toggle"
                className={btn}
                disabled={!canAutoplay}
              >
                {running ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
              </button>
              <button
                type="button"
                onClick={() => scrollBy(1)}
                aria-label={t.testimonials.next}
                title={t.testimonials.next}
                className={btn}
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default ReviewsSection;
