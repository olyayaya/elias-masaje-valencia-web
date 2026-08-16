import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fixed-size placeholders that occupy exactly the space the real content will
 * take, so nothing jumps when the database response lands. Motion is limited
 * to the calm `animate-pulse` opacity fade, disabled under reduced-motion.
 */

export const ServiceRowSkeleton = () => (
  <div data-testid="service-skeleton" className="flex flex-col md:flex-row md:items-center justify-between py-8 gap-4">
    <div className="flex-1 space-y-3">
      <Skeleton className="h-7 w-56 max-w-full" />
      <Skeleton className="h-4 w-full max-w-lg" />
      <Skeleton className="h-4 w-3/4 max-w-md" />
    </div>
    <div className="flex items-center gap-6 shrink-0">
      <Skeleton className="h-4 w-14" />
      <Skeleton className="h-4 w-12" />
      <Skeleton className="h-10 w-28 rounded-full" />
    </div>
  </div>
);

export const ServiceRowSkeletonList = ({ count = 3 }: { count?: number }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <ServiceRowSkeleton key={i} />
    ))}
  </>
);

/** Single-line placeholder for the rating / review-count line. */
export const RatingLineSkeleton = () => (
  <div data-testid="rating-skeleton" className="flex justify-center">
    <Skeleton className="h-5 w-64 max-w-full" />
  </div>
);

/** Fixed-height placeholder for a block of text lines (hours, address). */
export const TextLinesSkeleton = ({ lines = 3, testId }: { lines?: number; testId?: string }) => (
  <div data-testid={testId} className="space-y-2">
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} className="h-4 w-48 max-w-full" />
    ))}
  </div>
);

export const TestimonialCardSkeleton = () => (
  <div data-testid="testimonial-skeleton" className="bg-secondary/60 rounded-2xl border border-border/50 p-6 shrink-0" style={{ width: 320, height: 176 }}>
    <div className="space-y-2 mb-6">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-2/3" />
    </div>
    <Skeleton className="h-4 w-32" />
  </div>
);

export const FaqSkeleton = ({ count = 4 }: { count?: number }) => (
  <div data-testid="faq-skeleton" className="divide-y divide-border">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="py-5">
        <Skeleton className="h-5 w-3/4 max-w-md" />
      </div>
    ))}
  </div>
);
