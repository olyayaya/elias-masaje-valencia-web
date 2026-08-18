import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type { Plugin } from "vite";

/**
 * Self-hosts the single-thread ffmpeg.wasm core at /ffmpeg/*.
 *
 * The core MUST be the ESM build: @ffmpeg/ffmpeg spawns its worker with `{ type: "module" }`,
 * and module workers cannot call importScripts(). The worker therefore falls back to
 * `import(coreURL)` and needs a real `export default createFFmpegCore` — importing the UMD
 * build there yields an empty module and the load fails with a bare "failed to import
 * ffmpeg-core.js" string. Served from our own origin: no CDN, no cross-origin isolation.
 * The two files never enter the JS graph, so the main bundle stays free of the ~30 MB core.
 */
const FILES = ["ffmpeg-core.js", "ffmpeg-core.wasm"] as const;

/**
 * @ffmpeg/core does not export "./package.json" (or any deep path), so resolution goes through
 * the "require" condition of its main entry (the UMD folder) and we hop to the sibling ESM one.
 */
const coreDir = (root: string) => {
  const require = createRequire(path.join(root, "package.json"));
  const candidates: string[] = [];
  try {
    const umd = path.dirname(require.resolve("@ffmpeg/core"));
    candidates.push(path.join(path.dirname(umd), "esm"), umd);
  } catch {
    /* fall through to the literal node_modules paths below */
  }
  candidates.push(
    path.join(root, "node_modules/@ffmpeg/core/dist/esm"),
    path.join(root, "node_modules/@ffmpeg/core/dist/umd"),
  );
  for (const dir of candidates) {
    if (FILES.every((f) => fs.existsSync(path.join(dir, f)))) return dir;
  }
  throw new Error("ffmpeg core assets not found");
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
