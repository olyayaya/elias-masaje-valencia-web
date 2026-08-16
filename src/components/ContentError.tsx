import { useI18n } from "@/i18n/context";
import { WHATSAPP_URL } from "@/config/contact";
import { trackWhatsAppClick } from "@/lib/analytics";

interface ContentErrorProps {
  /** Re-runs the failed query. */
  onRetry: () => void;
  /** Adds a WhatsApp fallback for blocks where booking is the user's goal. */
  showWhatsApp?: boolean;
  /** Analytics location label for the WhatsApp fallback. */
  whatsappLocation?: string;
  className?: string;
}

/**
 * Neutral, localized fallback shown when a public content query fails.
 * Deliberately renders no business facts — stale services, prices, ratings or
 * opening hours must never appear in an error state.
 */
const ContentError = ({ onRetry, showWhatsApp, whatsappLocation = "content_error", className = "" }: ContentErrorProps) => {
  const { t } = useI18n();
  return (
    <div role="status" className={`flex flex-col sm:flex-row sm:items-center gap-3 py-8 ${className}`}>
      <p className="text-sm font-body text-muted-foreground">{t.common.loadError}</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="text-sm font-body border border-foreground/20 text-foreground px-5 py-2 rounded-full transition-all hover:bg-foreground hover:text-background"
        >
          {t.common.retry}
        </button>
        {showWhatsApp && (
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackWhatsAppClick(whatsappLocation)}
            className="text-sm font-body text-primary-strong hover:opacity-80 transition-opacity"
          >
            {t.nav.bookWhatsApp}
          </a>
        )}
      </div>
    </div>
  );
};

export default ContentError;
