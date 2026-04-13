import { Link } from "react-router-dom";
import { useI18n } from "@/i18n/context";
import { useSiteContent } from "@/hooks/use-site-content";
import { INSTAGRAM_HANDLE } from "@/config/contact";

const Footer = () => {
  const { t } = useI18n();
  const { content: sc } = useSiteContent();

  return (
    <footer className="bg-card border-t border-border section-padding">
      <div className="container-wide">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div>
            <h3 className="font-display text-2xl mb-4 text-foreground">Elias Masaje</h3>
            <p className="text-sm text-muted-foreground leading-relaxed font-body">{sc.footer_tagline || t.footer.tagline}</p>
          </div>
          <div>
            <h4 className="font-display text-lg mb-4 text-foreground">{t.footer.navigation}</h4>
            <nav className="flex flex-col gap-2" aria-label={t.a11y.footerNavigation}>
              <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-body">{t.nav.home}</Link>
              <Link to="/servicios" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-body">{t.nav.services}</Link>
              <Link to="/sobre-mi" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-body">{t.nav.about}</Link>
              <Link to="/blog" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-body">{t.nav.blog}</Link>
              <Link to="/contacto" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-body">{t.nav.contact}</Link>
            </nav>
          </div>
          <div>
            <h4 className="font-display text-lg mb-4 text-foreground">{t.footer.contact}</h4>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground font-body">
              <p>{sc.contact_address || t.contact.addressValue}</p>
              <p>{sc.contact_weekdays || t.contact.weekdays}</p>
              <p>{sc.contact_saturday || t.contact.saturday}</p>
              <a href={`https://instagram.com/${(sc.contact_instagram || INSTAGRAM_HANDLE).replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                {sc.contact_instagram || INSTAGRAM_HANDLE}
              </a>
            </div>
          </div>
        </div>
        <div className="mt-16 pt-8 border-t border-border text-center text-xs text-muted-foreground font-body">
          © {new Date().getFullYear()} Elias Masaje. {t.footer.rights}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
