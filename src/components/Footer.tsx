import { Link } from "react-router-dom";

const Footer = () => (
  <footer className="bg-foreground text-primary-foreground section-padding">
    <div className="container-wide">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        <div>
          <h3 className="font-display text-2xl mb-4">Elias Masaje</h3>
          <p className="text-sm opacity-70 leading-relaxed font-body">
            Masaje profesional en el centro de Valencia. Un espacio para bajar el ritmo y reconectar con tu cuerpo.
          </p>
        </div>
        <div>
          <h4 className="font-display text-lg mb-4">Navegación</h4>
          <nav className="flex flex-col gap-2">
            <Link to="/" className="text-sm opacity-70 hover:opacity-100 transition-opacity font-body">Inicio</Link>
            <Link to="/servicios" className="text-sm opacity-70 hover:opacity-100 transition-opacity font-body">Servicios</Link>
            <Link to="/sobre-mi" className="text-sm opacity-70 hover:opacity-100 transition-opacity font-body">Sobre mí</Link>
            <Link to="/contacto" className="text-sm opacity-70 hover:opacity-100 transition-opacity font-body">Contacto</Link>
          </nav>
        </div>
        <div>
          <h4 className="font-display text-lg mb-4">Contacto</h4>
          <div className="flex flex-col gap-2 text-sm opacity-70 font-body">
            <p>Centro de Valencia, España</p>
            <p>Lunes – Viernes: 9:00 – 20:00</p>
            <p>Sábado: 10:00 – 14:00</p>
            <a
              href="https://instagram.com/eliasmasaje"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-100 transition-opacity"
            >
              @eliasmasaje
            </a>
          </div>
        </div>
      </div>
      <div className="mt-16 pt-8 border-t border-primary-foreground/10 text-center text-xs opacity-50 font-body">
        © {new Date().getFullYear()} Elias Masaje. Todos los derechos reservados.
      </div>
    </div>
  </footer>
);

export default Footer;
