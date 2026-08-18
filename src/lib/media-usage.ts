import { supabase } from "@/integrations/supabase/client";

export type MediaUsage = { entity: string; label: string; id: string; field: string };

export type MediaGuardResult = {
  fileName: string;
  inUse: boolean;
  usages: MediaUsage[];
  /** Non-blocking: how many archived content versions still reference this file. */
  historyReferences?: number;
  deleted?: boolean;
  renamed?: boolean;
  replaced?: boolean;
  /** True when an alias row was written so history restores resolve the old name forward. */
  aliased?: boolean;
  newName?: string;
  updatedReferences?: number;
  originalSize?: number;
  newSize?: number;
  warning?: string;
};

/** Thrown for non-2xx guard responses so callers can branch on the server's reason. */
export class MediaGuardError extends Error {
  alreadyCompressed: boolean;
  constructor(message: string, opts?: { alreadyCompressed?: boolean }) {
    super(message);
    this.name = "MediaGuardError";
    this.alreadyCompressed = !!opts?.alreadyCompressed;
  }
}

type Action = "check" | "delete" | "rename" | "replace" | "usage-batch" | "commit-video";

const invoke = async <T = MediaGuardResult>(action: Action, body: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.functions.invoke("media-guard", {
    body: { action, ...body },
  });
  if (error) {
    // A 4xx (still in use / collision / already compressed) arrives as a FunctionsHttpError
    // with the JSON payload on the context response.
    const ctx = (error as unknown as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      const payload = await ctx.json().catch(() => null);
      if (payload && typeof payload === "object" && "usages" in payload) return payload as T;
      if (payload && typeof payload === "object" && "error" in payload) {
        const p = payload as { error: string; alreadyCompressed?: boolean };
        throw new MediaGuardError(String(p.error), { alreadyCompressed: !!p.alreadyCompressed });
      }
    }
    throw new MediaGuardError(error.message || "Media check failed");
  }
  if (data && (data as { error?: string }).error) throw new MediaGuardError((data as { error: string }).error);
  return data as T;
};

/** Fresh server-side usage lookup across all content tables. */
export const checkMediaUsage = (fileName: string) => invoke("check", { fileName });

/** Deletes only after the server re-verifies the file is unused. */
export const deleteMediaFile = (fileName: string) => invoke("delete", { fileName });

/** Server-side rename: copy → one transactional reference+alias rewrite → remove the old object. */
export const renameMediaFile = (fileName: string, newName: string) =>
  invoke("rename", { fileName, newName });

/**
 * Server-side replace used by smart compression. The server ignores originalSize (it reads the
 * real stored object) and re-applies the 10% / 10 KB threshold.
 */
export const replaceMediaFile = (args: {
  fileName: string;
  newName: string;
  contentBase64: string;
  contentType: string;
  originalSize: number;
  /**
   * "smart" (default) makes the server re-apply the 10% / 10 KB saving rule.
   * "manual" is an explicitly admin-confirmed replacement that may be bigger — it never
   * relaxes the auth, MIME/magic-byte or size checks.
   */
  mode?: "smart" | "manual";
}) => invoke("replace", args);

/**
 * One server-side scan that counts live references for many files at once — used by the
 * library's used/unused filter so the UI never fires N usage requests.
 */
/** The server refuses more than this per request — the client must chunk, not truncate. */
export const USAGE_BATCH_LIMIT = 500;

/**
 * Resolves usage counts for an arbitrary number of files by splitting the request into
 * server-sized chunks and merging the answers. A library with 1200 objects must not
 * silently lose the last 700.
 */
export async function checkMediaUsageBatch(fileNames: string[]): Promise<{ usage: Record<string, number> }> {
  const usage: Record<string, number> = {};
  for (let i = 0; i < fileNames.length; i += USAGE_BATCH_LIMIT) {
    const chunk = fileNames.slice(i, i + USAGE_BATCH_LIMIT);
    if (!chunk.length) continue;
    const res = await invoke<{ usage: Record<string, number> }>("usage-batch", { fileNames: chunk });
    Object.assign(usage, res.usage ?? {});
  }
  return { usage };
}


/**
 * Promotes a resumably-uploaded video object over an existing one. The server re-verifies
 * container magic bytes, the real stored sizes and (for smart conversion) the 10% / 10 KB
 * threshold, then rewrites every content reference + alias in one transaction.
 */
export const commitVideoReplacement = (args: {
  fileName: string;
  stagedName: string;
  newName: string;
  contentType: string;
  enforceSaving?: boolean;
  /** Same explicit contract as replaceMediaFile. */
  mode?: "smart" | "manual";
}) => invoke("commit-video", args);
