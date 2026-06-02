import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Cookie, X, Shield } from "lucide-react";
import { useI18n } from "@/i18n/context";
import { useLocalePath } from "@/hooks/use-locale-path";
import {
  ALL_GRANTED,
  ConsentCategories,
  DEFAULT_CONSENT,
  getConsent,
  setConsent,
} from "@/lib/consent";

type View = "hidden" | "banner" | "panel";

/**
 * Cookie consent surface: small bottom-fixed banner with Accept / Reject /
 * Manage actions; clicking Manage opens a granular toggle panel.
 *
 * No prompt is shown once a decision is recorded (per CONSENT_VERSION). The
 * choice gets pushed into Google Consent Mode v2 immediately so any Google
 * tag respects it. Other integrations (use-integrations-injector) read the
 * stored consent before injecting scripts.
 */
const ConsentBanner = () => {
  const { t } = useI18n();
  const lp = useLocalePath();
  const [view, setView] = useState<View>("hidden");
  const [draft, setDraft] = useState<ConsentCategories>(DEFAULT_CONSENT);

  useEffect(() => {
    if (getConsent() === null) setView("banner");
  }, []);

  const acceptAll = () => {
    setConsent(ALL_GRANTED);
    setView("hidden");
  };
  const rejectAll = () => {
    setConsent(DEFAULT_CONSENT);
    setView("hidden");
  };
  const saveCustom = () => {
    setConsent(draft);
    setView("hidden");
  };

  if (view === "hidden") return null;

  const c = t.cookies;

  return (
    <>
      {/* Compact banner */}
      {view === "banner" && (
        <div
          role="dialog"
          aria-live="polite"
          aria-label={c.panel.title}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] w-[calc(100%-2rem)] max-w-2xl"
        >
          <div className="bg-card/95 backdrop-blur-md border border-border rounded-2xl shadow-lg p-4 md:p-5">
            <div className="flex items-start gap-3">
              <Cookie className="shrink-0 text-primary mt-0.5" size={20} aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground leading-relaxed">
                  {c.banner.body}{" "}
                  <Link
                    to={lp("privacy")}
                    className="text-primary hover:underline"
                  >
                    {c.banner.policyLink}
                  </Link>
                  .
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    onClick={acceptAll}
                    className="px-4 py-2 text-sm bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity"
                  >
                    {c.banner.accept}
                  </button>
                  <button
                    onClick={rejectAll}
                    className="px-4 py-2 text-sm border border-border text-foreground rounded-lg hover:bg-secondary transition-colors"
                  >
                    {c.banner.reject}
                  </button>
                  <button
                    onClick={() => setView("panel")}
                    className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors"
                  >
                    {c.banner.preferences}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Granular panel */}
      {view === "panel" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={c.panel.title}
          className="fixed inset-0 z-[80] flex items-end md:items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setView("banner"); }}
        >
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
              <div className="flex items-start gap-2">
                <Shield size={18} className="text-primary mt-1" aria-hidden="true" />
                <div>
                  <h2 className="text-base font-semibold text-foreground">{c.panel.title}</h2>
                  <p className="text-xs text-muted-foreground mt-1">{c.panel.description}</p>
                </div>
              </div>
              <button
                onClick={() => setView("banner")}
                aria-label={c.panel.cancel}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <CategoryRow
                title={c.panel.necessary.title}
                body={c.panel.necessary.body}
                checked={true}
                disabled
                alwaysOnLabel={c.panel.alwaysOn}
              />
              <CategoryRow
                title={c.panel.preferences.title}
                body={c.panel.preferences.body}
                checked={draft.preferences}
                onChange={(v) => setDraft({ ...draft, preferences: v })}
              />
              <CategoryRow
                title={c.panel.analytics.title}
                body={c.panel.analytics.body}
                checked={draft.analytics}
                onChange={(v) => setDraft({ ...draft, analytics: v })}
              />
              <CategoryRow
                title={c.panel.marketing.title}
                body={c.panel.marketing.body}
                checked={draft.marketing}
                onChange={(v) => setDraft({ ...draft, marketing: v })}
              />
            </div>

            <div className="flex justify-end gap-2 p-5 border-t border-border">
              <button
                onClick={() => setView("banner")}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors"
              >
                {c.panel.cancel}
              </button>
              <button
                onClick={saveCustom}
                className="px-4 py-2 text-sm bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity"
              >
                {c.panel.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const CategoryRow = ({
  title,
  body,
  checked,
  onChange,
  disabled,
  alwaysOnLabel,
}: {
  title: string;
  body: string;
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  alwaysOnLabel?: string;
}) => (
  <div className="flex items-start justify-between gap-4">
    <div className="min-w-0">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{body}</p>
    </div>
    {disabled ? (
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1 rounded-full bg-secondary shrink-0">
        {alwaysOnLabel}
      </span>
    ) : (
      <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={checked}
          onChange={(e) => onChange?.(e.target.checked)}
        />
        <span className="w-9 h-5 bg-secondary peer-checked:bg-primary rounded-full transition-colors relative">
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-background rounded-full transition-transform ${checked ? "translate-x-4" : ""}`} />
        </span>
      </label>
    )}
  </div>
);

export default ConsentBanner;
