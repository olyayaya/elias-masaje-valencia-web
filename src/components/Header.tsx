import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useI18n } from "@/i18n/context";
import LanguageSwitcher from "./LanguageSwitcher";

const WHATSAPP_URL = "https://wa.me/34698968007?text=Hola%2C%20me%20gustaría%20reservar%20una%20cita";

const Header = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { t } = useI18n();

  const navItems = [
    { label: t.nav.home, path: "/" },
    { label: t.nav.services, path: "/servicios" },
    { label: t.nav.about, path: "/sobre-mi" },
    { label: t.nav.contact, path: "/contacto" },
    { label: t.nav.blog, path: "/blog" },
  ];

  // Close mobile menu on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape" && open) setOpen(false);
  }, [open]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      {/* Skip to main content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded focus:text-sm focus:font-body"
      >
        {t.a11y.skipToContent}
      </a>

      <header className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-sm border-b border-border">
        <div className="container-wide flex items-center justify-between h-16 px-5 md:px-8 lg:px-12">
          <Link to="/" className="font-display text-xl tracking-wide text-foreground">
            Elias Masaje
          </Link>

          <nav className="hidden md:flex items-center gap-8" aria-label={t.a11y.mainNavigation}>
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`text-sm font-body tracking-wide transition-colors hover:text-primary ${
                  location.pathname === item.path ? "text-primary" : "text-muted-foreground"
                }`}
                aria-current={location.pathname === item.path ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
            <LanguageSwitcher />
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-body bg-primary text-primary-foreground px-5 py-2 rounded transition-opacity hover:opacity-90"
            >
              {t.nav.book}
            </a>
          </nav>

          <div className="flex items-center gap-4 md:hidden">
            <LanguageSwitcher />
            <button
              onClick={() => setOpen(!open)}
              className="text-foreground"
              aria-label={t.a11y.toggleMenu}
              aria-expanded={open}
            >
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {open && (
          <nav
            className="relative z-50 md:hidden bg-background border-b border-border px-5 pb-6 pt-2"
            aria-label={t.a11y.mainNavigation}
            role="navigation"
          >
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setOpen(false)}
                className={`block py-3 text-sm font-body tracking-wide transition-colors ${
                  location.pathname === item.path ? "text-primary" : "text-muted-foreground"
                }`}
                aria-current={location.pathname === item.path ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-3 text-center text-sm font-body bg-primary text-primary-foreground px-5 py-2.5 rounded"
            >
              {t.nav.bookWhatsApp}
            </a>
          </nav>
        )}
      </header>

      {/* Portal overlay — rendered outside header stacking context */}
      {open && createPortal(
        <div
          className="fixed inset-0 top-16 z-40 bg-black/40 backdrop-blur-md md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />,
        document.body
      )}
    </>
  );
};

export default Header;
