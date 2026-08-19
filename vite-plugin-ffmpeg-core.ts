import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { build as esbuild } from "esbuild";
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


/**
 * The worker @ffmpeg/ffmpeg spawns. Its own `new Worker(new URL("./worker.js", import.meta.url))`
 * is rewritten by Vite's dep optimizer to /node_modules/.vite/deps/worker.js, which does NOT
 * exist (404) — the worker dies before answering the LOAD message and `load()` hangs forever.
 * We therefore bundle the ESM worker ourselves and hand it to `load({ classWorkerURL })`.
 */
const WORKER_FILE = "ffmpeg-worker.js";

const workerEntry = (root: string) => {
  const require = createRequire(path.join(root, "package.json"));
  const candidates: string[] = [];
  try {
    candidates.push(path.join(path.dirname(require.resolve("@ffmpeg/ffmpeg")), "../esm/worker.js"));
  } catch {
    /* ignore */
  }
  candidates.push(path.join(root, "node_modules/@ffmpeg/ffmpeg/dist/esm/worker.js"));
  return candidates.find((f) => fs.existsSync(f)) ?? "";
};

async function bundleWorker(root: string): Promise<string> {
  const entry = workerEntry(root);
  if (!entry) return "";
  const out = await esbuild({
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    platform: "browser",
    write: false,
    minify: true,
  });
  return out.outputFiles[0]?.text ?? "";
}

export function ffmpegCore(root: string): Plugin {
  let dir = "";
  let workerCode = "";
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
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.startsWith(`/ffmpeg/${WORKER_FILE}`)) {
          if (!workerCode) workerCode = await bundleWorker(root).catch(() => "");
          if (!workerCode) return next();
          res.setHeader("Content-Type", "text/javascript");
          res.end(workerCode);
          return;
        }
        const file = FILES.find((f) => req.url?.startsWith(`/ffmpeg/${f}`));
        if (!file || !dir) return next();
        res.setHeader("Content-Type", file.endsWith(".wasm") ? "application/wasm" : "text/javascript");
        fs.createReadStream(path.join(dir, file)).pipe(res);
      });
    },
    async writeBundle(options) {
      if (!dir) return;
      const out = path.join(options.dir ?? path.join(root, "dist"), "ffmpeg");
      fs.mkdirSync(out, { recursive: true });
      for (const file of FILES) fs.copyFileSync(path.join(dir, file), path.join(out, file));
      if (!workerCode) workerCode = await bundleWorker(root).catch(() => "");
      if (workerCode) fs.writeFileSync(path.join(out, WORKER_FILE), workerCode);
    },
  };
}

export const FFMPEG_CORE_URL = "/ffmpeg/ffmpeg-core.js";
export const FFMPEG_WASM_URL = "/ffmpeg/ffmpeg-core.wasm";
export const FFMPEG_WORKER_URL = `/ffmpeg/${WORKER_FILE}`;
