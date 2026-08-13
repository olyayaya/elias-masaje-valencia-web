import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useHead } from "@/hooks/use-head";

const NotFound = () => {
  const location = useLocation();

  useHead({
    title: "404 — Página no encontrada | Elias Masaje",
    description: "La página que buscas no existe. Vuelve al inicio de Elias Masaje.",
    robots: "noindex, follow",
  });

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <a href="/" className="text-primary-strong underline hover:text-primary/90">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
