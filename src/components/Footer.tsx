import { Link } from "react-router-dom";
import { Facebook } from "lucide-react";
import { useI18n } from "@/i18n/context";
import { useSiteContent } from "@/hooks/use-site-content";
import { useLocalePath } from "@/hooks/use-locale-path";
import { INSTAGRAM_HANDLE } from "@/config/contact";
import { openConsentSettings } from "@/lib/consent";
import { TextLinesSkeleton } from "@/components/skeletons/ContentSkeletons";

// Brand glyphs not included in lucide
const GoogleIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M21.6 12.227c0-.708-.064-1.388-.182-2.04H12v3.86h5.385a4.6 4.6 0 0 1-1.996 3.018v2.51h3.232c1.89-1.74 2.98-4.305 2.98-7.348z"/>
    <path d="M12 22c2.7 0 4.964-.895 6.62-2.425l-3.23-2.51c-.896.6-2.04.957-3.39.957-2.605 0-4.81-1.76-5.598-4.124H3.064v2.59A9.997 9.997 0 0 0 12 22z"/>
    <path d="M6.402 13.898A6.005 6.005 0 0 1 6.09 12c0-.66.114-1.3.312-1.898V7.512H3.064A9.996 9.996 0 0 0 2 12c0 1.614.387 3.14 1.064 4.488l3.338-2.59z"/>
    <path d="M12 5.977c1.47 0 2.788.505 3.825 1.498l2.868-2.868C16.96 2.99 14.696 2 12 2A9.997 9.997 0 0 0 3.064 7.512l3.338 2.59C7.19 7.737 9.395 5.977 12 5.977z"/>
  </svg>
);

const TripAdvisorIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M12 7.5c-2.21 0-4.27.61-6.04 1.66H2l1.78 1.94A4.5 4.5 0 0 0 7 18.5c1.27 0 2.42-.53 3.24-1.38L12 19l1.76-1.88c.82.85 1.97 1.38 3.24 1.38a4.5 4.5 0 0 0 3.22-7.4L22 9.16h-3.96A11.97 11.97 0 0 0 12 7.5zM7 10.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zm10 0a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM7 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
  </svg>
);

const Footer = () => {
  const { t } = useI18n();
  const { content: sc, status: scStatus } = useSiteContent();
  const lp = useLocalePath();

  return (
    <footer className="relative bg-card section-padding overflow-visible">
      <div className="pointer-events-none absolute -top-16 md:-top-24 left-0 right-0 h-16 md:h-24 z-10" aria-hidden="true">
        <svg viewBox="0 0 1440 96" preserveAspectRatio="none" className="block h-full w-full">
          <path d="M0,96 C480,0 960,0 1440,96 L1440,96 L0,96 Z" style={{ fill: "hsl(var(--card))" }} />
        </svg>
      </div>

      <div className="container-wide relative z-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div>
            <h3 className="font-display text-2xl mb-4 text-foreground">Elias Masaje</h3>
            <p className="text-sm text-muted-foreground leading-relaxed font-body">{sc.footer_tagline || t.footer.tagline}</p>
          </div>
          <div>
            <h4 className="font-display text-lg mb-4 text-foreground">{t.footer.navigation}</h4>
            <nav className="flex flex-col gap-2" aria-label={t.a11y.footerNavigation}>
              <Link to={lp("home")} className="text-sm text-muted-foreground hover:text-foreground transition-colors font-body">{t.nav.home}</Link>
              <Link to={lp("services")} className="text-sm text-muted-foreground hover:text-foreground transition-colors font-body">{t.nav.services}</Link>
              <Link to={lp("about")} className="text-sm text-muted-foreground hover:text-foreground transition-colors font-body">{t.nav.about}</Link>
              <Link to={lp("blog")} className="text-sm text-muted-foreground hover:text-foreground transition-colors font-body">{t.nav.blog}</Link>
              <Link to={lp("contact")} className="text-sm text-muted-foreground hover:text-foreground transition-colors font-body">{t.nav.contact}</Link>
            </nav>
          </div>
          <div>
            <h4 className="font-display text-lg mb-4 text-foreground">{t.footer.contact}</h4>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground font-body">
              {scStatus === "loading" ? (
                <TextLinesSkeleton lines={3} testId="footer-contact-skeleton" />
              ) : (
                <>
                  {sc.contact_address && <p>{sc.contact_address}</p>}
                  {sc.contact_weekdays && <p>{sc.contact_weekdays}</p>}
                  {sc.contact_saturday && <p>{sc.contact_saturday}</p>}
                  {sc.contact_sunday && <p>{sc.contact_sunday}</p>}

                </>
              )}
              {(() => {
                const socials: { href: string; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [];
                if (sc.contact_facebook_url) socials.push({ href: sc.contact_facebook_url, label: "Facebook", Icon: ({ className }) => <Facebook className={className} /> });
                if (sc.contact_google_url) socials.push({ href: sc.contact_google_url, label: "Google", Icon: GoogleIcon });
                const tripUrl = sc.integration_tripadvisor_url || sc.contact_tripadvisor_url;
                if (tripUrl) socials.push({ href: tripUrl, label: "TripAdvisor", Icon: TripAdvisorIcon });
                if (!socials.length) return null;
                return (
                  <div className="flex items-center gap-3 mt-3">
                    {socials.map(({ href, label, Icon }) => (
                      <a
                        key={label}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={label}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                      >
                        <Icon className="w-4 h-4" />
                      </a>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
        <div className="mt-16 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-center text-xs text-muted-foreground font-body">
          <span>© {new Date().getFullYear()} Elias Masaje. {t.footer.rights}</span>
          <span className="hidden sm:inline" aria-hidden="true">·</span>
          <Link to={lp("privacy")} className="hover:text-foreground transition-colors">
            {t.cookies.privacy.heading}
          </Link>
          <span className="hidden sm:inline" aria-hidden="true">·</span>
          <button
            type="button"
            onClick={openConsentSettings}
            className="hover:text-foreground transition-colors"
          >
            {t.cookies.panel.title}
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
