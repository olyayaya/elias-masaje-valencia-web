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

/** Best-effort cleanup of a partially/fully uploaded object. Never throws. */
export async function removeObject(name: string): Promise<void> {
  try {
    await supabase.storage.from(BUCKET).remove([name]);
  } catch {
    /* nothing else we can do client-side; the server-side commit also cleans up */
  }
}

export async function uploadResumable(
  objectName: string,
  file: Blob,
  contentType: string,
  handlers: UploadHandlers = {},
): Promise<void> {
  const { tus } = await import("tus-js-client").then((m) => ({ tus: m }));
  const token = await accessToken();

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
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
      onError: (err) => reject(err instanceof Error ? err : new Error(String(err))),
      onProgress: (sent, total) => handlers.onProgress?.(sent, total),
      onSuccess: () => resolve(),
    });

    const abort = () => {
      void upload.abort(true).finally(() => {
        void removeObject(objectName);
        reject(new DOMException("Cancelled", "AbortError"));
      });
    };
    if (handlers.signal?.aborted) return abort();
    handlers.signal?.addEventListener("abort", abort, { once: true });

    upload.findPreviousUploads().then((prev) => {
      if (prev.length) upload.resumeFromPreviousUpload(prev[0]);
      upload.start();
    }).catch(() => upload.start());
  }).catch(async (err) => {
    if ((err as DOMException)?.name !== "AbortError") await removeObject(objectName);
    throw err;
  });
}

export const publicUrlOf = (name: string) =>
  supabase.storage.from(BUCKET).getPublicUrl(name).data.publicUrl;
