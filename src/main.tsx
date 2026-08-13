import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { enforceCanonicalUrl } from "./lib/canonical-url";
import { initSentry, getCachedSentryDsn } from "./lib/sentry";

// Boot error reporting as early as possible (cached DSN) so first-render
// crashes are captured; the injector refreshes the DSN from the database.
initSentry(getCachedSentryDsn());

// Consolidate SEO signals: https, no trailing slash, lowercase paths.
enforceCanonicalUrl();

createRoot(document.getElementById("root")!).render(<App />);
