import { supabase } from "@/integrations/supabase/client";

export type MediaUsage = { entity: string; label: string; id: string; field: string };

export type MediaGuardResult = {
  fileName: string;
  inUse: boolean;
  usages: MediaUsage[];
  deleted?: boolean;
};

const invoke = async (action: "check" | "delete", fileName: string): Promise<MediaGuardResult> => {
  const { data, error } = await supabase.functions.invoke("media-guard", {
    body: { action, fileName },
  });
  if (error) {
    // A 409 (still in use) arrives as a FunctionsHttpError with the payload in context
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
export const checkMediaUsage = (fileName: string) => invoke("check", fileName);

/** Deletes only after the server re-verifies the file is unused. */
export const deleteMediaFile = (fileName: string) => invoke("delete", fileName);
