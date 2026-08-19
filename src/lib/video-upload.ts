/**
 * Resumable upload of large media straight to Storage (tus protocol), with progress and
 * cancel. Videos never travel as base64 through an Edge Function body.
 *
 * Cancel/error always removes the partially created object, so a failed upload can never
 * leave an orphan behind.
 */
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "media";
const CHUNK = 6 * 1024 * 1024; // Supabase requires exactly 6 MB chunks for tus

export interface UploadHandlers {
  onProgress?: (sent: number, total: number) => void;
  signal?: AbortSignal;
}

async function accessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");
  return token;
}

const endpoint = () => `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/upload/resumable`;

/**
 * Best-effort cleanup of a partially/fully uploaded object. Never throws, but reports
 * honestly whether the object is actually gone — callers must not claim a clean state
 * when Storage refused the delete.
 */
export async function removeObject(name: string): Promise<boolean> {
  try {
    const { error } = await supabase.storage.from(BUCKET).remove([name]);
    return !error;
  } catch {
    /* nothing else we can do client-side; the server-side commit also cleans up */
    return false;
  }
}


/**
 * Reserved, user-bound name for a throwaway upload awaiting server promotion.
 * Must stay in sync with validateStagedName in supabase/functions/media-guard/rules.ts
 * (a test asserts the server accepts exactly what this produces).
 */
export async function stagedObjectName(ext: string): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) throw new Error("Not signed in");
  return `staged-${userId}-${crypto.randomUUID()}.${ext.toLowerCase()}`;
}

/**
 * Raised when the tus client module cannot be loaded/instantiated. Carries a name the UI
 * can map to a localized sentence — the raw (minified) technical text stays in console.
 */
export class UploadClientError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "UploadClientError";
  }
}

/**
 * The Upload constructor, resolved from the module's NAMED export.
 *
 * Do NOT reintroduce `import("tus-js-client").then((m) => ({ tus: m }))`: Rollup rewrote
 * that shape into a preload wrapper whose inner arrow re-destructured the chunk, so the
 * object reaching `new tus.Upload()` was `{ tus: undefined }` and production failed with
 * the minified "i.Upload is not a constructor".
 */
async function loadUploadClass(): Promise<typeof import("tus-js-client").Upload> {
  let mod: typeof import("tus-js-client");
  try {
    mod = await import("tus-js-client");
  } catch (e) {
    console.error("[video-upload] tus-js-client failed to load", e);
    throw new UploadClientError("tus-js-client could not be imported", e);
  }
  const Upload = mod?.Upload ?? (mod as { default?: { Upload?: unknown } })?.default?.Upload;
  if (typeof Upload !== "function") {
    console.error("[video-upload] unexpected tus-js-client module shape", Object.keys(mod ?? {}));
    throw new UploadClientError("tus-js-client exposes no Upload constructor");
  }
  return Upload as typeof import("tus-js-client").Upload;
}

export async function uploadResumable(
  objectName: string,
  file: Blob,
  contentType: string,
  handlers: UploadHandlers = {},
): Promise<void> {
  const Upload = await loadUploadClass();
  const token = await accessToken();
  const signal = handlers.signal;
  let abortListener: (() => void) | null = null;

  await new Promise<void>((resolve, reject) => {
    // Guards the tus lifecycle: once the upload is aborted (or has settled) no late
    // callback may start it. findPreviousUploads() can resolve long after a cancel.
    let settled = false;
    let aborted = false;

    const upload = new Upload(file, {

      endpoint: endpoint(),
      retryDelays: [0, 1000, 3000, 5000],
      headers: { authorization: `Bearer ${token}`, "x-upsert": "false" },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: BUCKET,
        objectName,
        contentType,
        cacheControl: "3600",
      },
      chunkSize: CHUNK,
      onError: (err) => {
        if (settled) return;
        settled = true;
        detach();
        reject(err instanceof Error ? err : new Error(String(err)));
      },
      onProgress: (sent, total) => handlers.onProgress?.(sent, total),
      // The listener is detached FIRST: a late abort must never delete an object that
      // has already been uploaded successfully.
      onSuccess: () => {
        if (settled) return;
        settled = true;
        detach();
        resolve();
      },
    });

    function detach() {
      if (abortListener) signal?.removeEventListener("abort", abortListener);
      abortListener = null;
    }

    const abort = () => {
      aborted = true;
      detach();
      void upload.abort(true).finally(() => {
        void removeObject(objectName);
        if (settled) return;
        settled = true;
        reject(new DOMException("Cancelled", "AbortError"));
      });
    };
    if (signal?.aborted) return abort();
    abortListener = abort;
    signal?.addEventListener("abort", abort, { once: true });

    // A resolve arriving after the cancel must not resurrect the transfer.
    const start = () => {
      if (aborted || settled || signal?.aborted) return;
      upload.start();
    };
    upload.findPreviousUploads().then((prev) => {
      if (aborted || settled || signal?.aborted) return;
      if (prev.length) upload.resumeFromPreviousUpload(prev[0]);
      start();
    }).catch(start);
  }).catch(async (err) => {
    if (abortListener) signal?.removeEventListener("abort", abortListener);
    if ((err as DOMException)?.name !== "AbortError") await removeObject(objectName);
    throw err;
  });

}

export const publicUrlOf = (name: string) =>
  supabase.storage.from(BUCKET).getPublicUrl(name).data.publicUrl;

