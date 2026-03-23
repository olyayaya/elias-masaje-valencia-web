import { Outlet } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import WhatsAppButton from "./WhatsAppButton";
import ThemeSwitcher from "./ThemeSwitcher";

const Layout = () => (
  <div className="min-h-screen flex flex-col">
    <Header />
    <main className="flex-1 pt-16">
      <Outlet />
    </main>
    <Footer />
    <WhatsAppButton />
    <ThemeSwitcher />
  </div>
);

export default Layout;
