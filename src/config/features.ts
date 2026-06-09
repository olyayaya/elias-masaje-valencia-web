/**
 * Feature flags.
 *
 * AI_ENABLED — master switch for the AI content/blog helpers that call the
 * Lovable AI gateway (edge functions `ai-content-helper` / `blog-generator`).
 * The client opted out of AI features, so this is OFF: the dashboard hides every
 * AI button and the handlers early-return, so the paid gateway is never called.
 * The edge functions and their code are left intact — flip this to `true` (and
 * deploy the functions + set AI_GATEWAY_KEY) to restore.
 */
export const AI_ENABLED = false;
