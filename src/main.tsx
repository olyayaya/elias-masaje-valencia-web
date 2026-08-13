import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { enforceCanonicalUrl } from "./lib/canonical-url";

// Consolidate SEO signals: https, no trailing slash, lowercase paths.
enforceCanonicalUrl();

createRoot(document.getElementById("root")!).render(<App />);
