import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listBookingLeads from "./tools/list-booking-leads";
import updateBookingLeadStatus from "./tools/update-booking-lead-status";
import createWhatsappBookingRequest from "./tools/create-whatsapp-booking-request";
import listServices from "./tools/list-services";
import listBlogPosts from "./tools/list-blog-posts";
import createBlogDraft from "./tools/create-blog-draft";
import conversionStats from "./tools/conversion-stats";

// Direct Supabase issuer host, built from the project ref (inlined at build time).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "elias-masaje-website",
  title: "Elias Masaje Website",
  version: "0.1.0",
  instructions:
    "Tools for the Elias Masaje massage website. Read and triage WhatsApp booking leads, review services and blog posts, draft new blog posts, and summarise website conversion events. All tools act as the signed-in admin account.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listBookingLeads,
    updateBookingLeadStatus,
    listServices,
    listBlogPosts,
    createBlogDraft,
    conversionStats,
  ],
});
