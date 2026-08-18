const post = (m) => self.postMessage(m);
self.onmessage = async () => {
  try {
    try { importScripts(self.location.origin + '/ffmpeg/ffmpeg-core.js'); post({step:'importScripts ok', type: typeof self.createFFmpegCore}); }
    catch (e) {
      post({step:'importScripts failed', err:String(e && e.message || e)});
      const mod = await import(self.location.origin + '/ffmpeg/ffmpeg-core.js');
      post({step:'dynamic import done', default: typeof mod.default, globalCore: typeof self.createFFmpegCore, keys: Object.keys(mod)});
    }
    const factory = self.createFFmpegCore;
    if (typeof factory !== 'function') { post({step:'no factory'}); return; }
    const t = Date.now();
    const core = await factory({ mainScriptUrlOrBlob: self.location.origin + '/ffmpeg/ffmpeg-core.js#' + btoa(JSON.stringify({wasmURL: self.location.origin + '/ffmpeg/ffmpeg-core.wasm', workerURL:''})) });
    post({step:'core ready', ms: Date.now()-t});
  } catch (e) { post({step:'threw', err:String(e && e.message || e), stack: String(e && e.stack || '').slice(0,300)}); }
};
