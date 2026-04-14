import { Outlet } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import WhatsAppButton from "./WhatsAppButton";
import ThemeSwitcher from "./ThemeSwitcher";

const Layout = () => (
  <>
    <Header />
    <div className="min-h-screen flex flex-col ambient-glow">
      <main id="main-content" className="flex-1 pt-16">
        <Outlet />
      </main>
      <Footer />
    </div>
    <WhatsAppButton />
    <ThemeSwitcher />
  </>
);

export default Layout;
