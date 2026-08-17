import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/i18n/context";
import { useFadeIn } from "@/hooks/use-fade-in";
import ContentError from "@/components/ContentError";
import { TestimonialCardSkeleton } from "@/components/skeletons/ContentSkeletons";
import { usePublicReviews } from "@/hooks/use-reviews";
import { SOURCE_PROFILE_URL, displayReviews, type Review } from "@/lib/reviews";

/* ------------------------------------------------------------------ *
 * Public reviews — real imported reviews only.
 *
 * There is no legacy fallback and no invented card: when the storage is not
 * there, the section is switched off, or nothing passes the owner's filters,
 * the whole block (heading, divider, cards) is simply absent from the page.
 *
 * The row is a plain scroll-snap list: no autoplay, no duplicated cards, no
 * requestAnimationFrame. That makes touch swipe, keyboard scrolling and
 * prefers-reduced-motion the browser's job instead of ours.
 * ------------------------------------------------------------------ */

/**
 * Only licensed sources are ever rendered here. TripAdvisor content is not
 * stored, not filtered and not shown in this block — the dashboard links to the
 * TripAdvisor profile instead.
 */
const SOURCE_LABEL: Record<Review["source"], string> = {
  google: "Google",
  manual: "",
};

const CLAMP_CHARS = 180;

const Stars = ({ n, label }: { n: number; label: string }) => (
  <span className="flex gap-0.5 mb-2" role="img" aria-label={label}>
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

const ReviewCard = ({ review }: { review: Review }) => {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const longText = review.review_text.length > CLAMP_CHARS;
  const sourceLabel = SOURCE_LABEL[review.source] ?? "";
  // A per-review permalink when the provider gives one, otherwise the public
  // profile of that source. Never presented as "this exact review".
  const href = review.original_url ?? SOURCE_PROFILE_URL[review.source];

  return (
    <li
      className="snap-start shrink-0 w-[85vw] sm:w-[340px] bg-secondary/60 rounded-2xl border border-border/50 p-6"
      data-testid="review-card"
    >
      <Stars n={review.rating} label={t.testimonials.ratingAria.replace("{n}", String(review.rating))} />
      <blockquote className="text-sm text-muted-foreground font-body leading-relaxed italic">
        <p className={!expanded && longText ? "line-clamp-4" : undefined}>{review.review_text}</p>
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
      <footer className="flex items-center justify-between gap-2 mt-4">
        <p className="text-sm font-body font-medium not-italic">
          <cite className="not-italic">{review.author_name.trim() || t.testimonials.anonymousAuthor}</cite>
        </p>
        <div className="flex items-center gap-2 shrink-0">
          {review.reviewed_at && (
            <span className="text-[10px] font-body text-muted-foreground/60">
              {new Date(review.reviewed_at).toLocaleDateString()}
            </span>
          )}
          {sourceLabel &&
            (href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-body text-muted-foreground/60 uppercase tracking-wider underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded"
              >
                {sourceLabel}
              </a>
            ) : (
              <span className="text-[10px] font-body text-muted-foreground/60 uppercase tracking-wider">
                {sourceLabel}
              </span>
            ))}
        </div>
      </footer>
    </li>
  );
};

const ReviewsSection = () => {
  const { t } = useI18n();
  const heading = useFadeIn(0);
  const scroller = useRef<HTMLUListElement>(null);
  const { items, settings, missingTable, isPending, isError, retry } = usePublicReviews();

  // The storage is not there yet → the section does not exist. No legacy cards.
  if (missingTable) return null;

  if (isError) {
    return (
      <section className="px-6 md:px-12 lg:px-20 py-20 md:py-28" data-testid="reviews-section">
        <div className="max-w-5xl mx-auto">
          <ContentError onRetry={retry} />
        </div>
      </section>
    );
  }

  if (isPending) {
    return (
      <section className="px-6 md:px-12 lg:px-20 py-20 md:py-28" data-testid="reviews-section">
        <div className="max-w-5xl mx-auto flex gap-5 overflow-hidden" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <TestimonialCardSkeleton key={i} />
          ))}
        </div>
      </section>
    );
  }

  const reviews = displayReviews(items, settings);
  // Section disabled, or nothing passes the owner's filters → render nothing at all.
  if (reviews.length === 0) return null;

  const scrollBy = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.8, 260), behavior: "smooth" });
  };

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
            className="flex gap-5 overflow-x-auto snap-x snap-mandatory pb-4 -mx-2 px-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-2xl"
          >
            {reviews.map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </ul>

          {reviews.length > 1 && (
            <div className="hidden md:flex justify-center gap-3 mt-2">
              <button
                type="button"
                onClick={() => scrollBy(-1)}
                aria-label={t.testimonials.prev}
                className="p-2 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => scrollBy(1)}
                aria-label={t.testimonials.next}
                className="p-2 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default ReviewsSection;
