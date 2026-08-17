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
  newName?: string;
  updatedReferences?: number;
  originalSize?: number;
  newSize?: number;
  warning?: string;
};

type Action = "check" | "delete" | "rename" | "replace";

const invoke = async (action: Action, body: Record<string, unknown>): Promise<MediaGuardResult> => {
  const { data, error } = await supabase.functions.invoke("media-guard", {
    body: { action, ...body },
  });
  if (error) {
    // A 409 (still in use / collision) arrives as a FunctionsHttpError with the payload in context
    const ctx = (error as unknown as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      const payload = await ctx.json().catch(() => null);
      if (payload && typeof payload === "object" && "usages" in payload) return payload as MediaGuardResult;
      if (payload && typeof payload === "object" && "error" in payload) {
        throw new Error(String((payload as { error: string }).error));
      }
    }
    throw new Error(error.message || "Media check failed");
  }
  if (data && (data as { error?: string }).error) throw new Error((data as { error: string }).error);
  return data as MediaGuardResult;
};

/** Fresh server-side usage lookup across all content tables. */
export const checkMediaUsage = (fileName: string) => invoke("check", { fileName });

/** Deletes only after the server re-verifies the file is unused. */
export const deleteMediaFile = (fileName: string) => invoke("delete", { fileName });

/** Server-side rename: copy → rewrite every reference → remove the old object (with rollback). */
export const renameMediaFile = (fileName: string, newName: string) =>
  invoke("rename", { fileName, newName });

/** Server-side replace used by smart compression. Rejects any result that is not smaller. */
export const replaceMediaFile = (args: {
  fileName: string;
  newName: string;
  contentBase64: string;
  contentType: string;
  originalSize: number;
}) => invoke("replace", args);
