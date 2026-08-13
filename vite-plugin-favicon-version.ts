import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import type { Plugin } from "vite";

/**
 * Tokens of the form `__HASH:some-file.png__` (and the legacy `__ICON_HASH__`,
 * which maps to favicon.png) are replaced with a short content hash of the
 * matching file in `public/`. Browsers therefore re-fetch icons automatically
 * whenever their bytes change — no manual cache clearing.
 */
const TOKEN_RE = /__HASH:([A-Za-z0-9._-]+)__|__ICON_HASH__/g;

export function faviconVersion(root = process.cwd()): Plugin {
  const cache = new Map<string, { mtime: number; hash: string }>();

  const hashOf = (file: string): string => {
    const full = path.resolve(root, "public", file);
    try {
      const mtime = fs.statSync(full).mtimeMs;
      const hit = cache.get(file);
      if (hit && hit.mtime === mtime) return hit.hash;
      const hash = createHash("md5").update(fs.readFileSync(full)).digest("hex").slice(0, 8);
      cache.set(file, { mtime, hash });
      return hash;
    } catch {
      return "0";
    }
  };

  const substitute = (text: string) =>
    text.replace(TOKEN_RE, (_m, file?: string) => hashOf(file ?? "favicon.png"));

  const manifestPath = path.resolve(root, "public/site.webmanifest");

  return {
    name: "favicon-version",
    transformIndexHtml(html) {
      return substitute(html);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith("/site.webmanifest")) return next();
        try {
          res.setHeader("Content-Type", "application/manifest+json");
          res.end(substitute(fs.readFileSync(manifestPath, "utf8")));
        } catch {
          next();
        }
      });
      server.watcher.add(path.resolve(root, "public"));
    },
    closeBundle() {
      const outFile = path.resolve(root, "dist/site.webmanifest");
      if (!fs.existsSync(outFile)) return;
      fs.writeFileSync(outFile, substitute(fs.readFileSync(outFile, "utf8")));
    },
  };
}
