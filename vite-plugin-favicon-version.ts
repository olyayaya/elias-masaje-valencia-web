import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import type { Plugin } from "vite";

const TOKEN = "__ICON_HASH__";

function hashFile(file: string): string {
  try {
    return createHash("md5").update(fs.readFileSync(file)).digest("hex").slice(0, 8);
  } catch {
    return "0";
  }
}

/**
 * Replaces `__ICON_HASH__` in index.html and site.webmanifest with a short
 * content hash of public/favicon.png, so browsers pick up a new favicon
 * automatically whenever the file changes (no manual cache clearing).
 */
export function faviconVersion(root = process.cwd()): Plugin {
  const iconPath = path.resolve(root, "public/favicon.png");
  const manifestPath = path.resolve(root, "public/site.webmanifest");

  const getHash = () => hashFile(iconPath);

  return {
    name: "favicon-version",
    transformIndexHtml(html) {
      return html.split(TOKEN).join(getHash());
    },
    configureServer(server) {
      // Serve a dev-time manifest with the hash substituted.
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith("/site.webmanifest")) return next();
        try {
          const body = fs.readFileSync(manifestPath, "utf8").split(TOKEN).join(getHash());
          res.setHeader("Content-Type", "application/manifest+json");
          res.end(body);
        } catch {
          next();
        }
      });
      server.watcher.add(iconPath);
    },
    closeBundle() {
      // Rewrite the emitted manifest in the build output.
      const outFile = path.resolve(root, "dist/site.webmanifest");
      if (!fs.existsSync(outFile)) return;
      const body = fs.readFileSync(outFile, "utf8").split(TOKEN).join(getHash());
      fs.writeFileSync(outFile, body);
    },
  };
}
