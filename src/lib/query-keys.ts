/**
 * Centralized React Query keys for Supabase content reads.
 *
 * Dashboard mutations should invalidate the matching key so the public
 * site picks up edits without a hard refresh:
 *   queryClient.invalidateQueries({ queryKey: queryKeys.services });
 */
export const queryKeys = {
  services: ["services"] as const,
  faqs: ["faqs"] as const,
  testimonials: ["testimonials"] as const,
  promotions: ["promotions"] as const,
  siteContent: ["site_content"] as const,
  pageImages: (collectionKey: string) => ["page_images", collectionKey] as const,
  pageImagesAll: ["page_images"] as const,
  blogPosts: ["blog_posts"] as const,
  blogPost: (slug: string) => ["blog_posts", slug] as const,
} as const;
