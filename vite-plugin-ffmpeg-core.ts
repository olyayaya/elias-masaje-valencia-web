import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type { Plugin } from "vite";

/**
 * Self-hosts the single-thread ffmpeg.wasm core at /ffmpeg/*.
 *
 * The core must be the UMD build (the ffmpeg worker loads it with importScripts) and it must
 * be served from our own origin — no CDN dependency and no cross-origin isolation needed.
 * @ffmpeg/core's package exports block deep imports, so instead of bundling it we copy the two
 * files: served from memory in dev, emitted next to the bundle in build. They never enter the
 * JS graph, so the main bundle stays free of the ~30 MB core.
 */
const FILES = ["ffmpeg-core.js", "ffmpeg-core.wasm"] as const;

const coreDir = (root: string) => {
  const require = createRequire(path.join(root, "package.json"));
  return path.dirname(require.resolve("@ffmpeg/core/package.json")) + "/dist/umd";
};

export function ffmpegCore(root: string): Plugin {
  let dir = "";
  return {
    name: "ffmpeg-core-assets",
    apply: () => true,
    configResolved() {
      try {
        dir = coreDir(root);
      } catch {
        dir = "";
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const file = FILES.find((f) => req.url?.startsWith(`/ffmpeg/${f}`));
        if (!file || !dir) return next();
        res.setHeader("Content-Type", file.endsWith(".wasm") ? "application/wasm" : "text/javascript");
        fs.createReadStream(path.join(dir, file)).pipe(res);
      });
    },
    writeBundle(options) {
      if (!dir) return;
      const out = path.join(options.dir ?? path.join(root, "dist"), "ffmpeg");
      fs.mkdirSync(out, { recursive: true });
      for (const file of FILES) fs.copyFileSync(path.join(dir, file), path.join(out, file));
    },
  };
}

export const FFMPEG_CORE_URL = "/ffmpeg/ffmpeg-core.js";
export const FFMPEG_WASM_URL = "/ffmpeg/ffmpeg-core.wasm";
