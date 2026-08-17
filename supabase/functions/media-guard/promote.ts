// Same-name object promotion with a real rollback path.
//
// Replacing a video under its existing name means the public URL must never point at a
// missing object, not even for the duration of a failed copy. The sequence below always
// keeps at least one intact copy of the original bytes:
//
//   1. copy original -> backup      (nothing destructive happened yet)
//   2. remove original              (backup holds the bytes)
//   3. copy staged   -> original    (on failure: restore from backup)
//   4. remove backup + staged
//
// Runtime-agnostic on purpose: the vitest suite drives it with a fake storage that can be
// told to fail at any step, so the rollback that protects production is the one under test.

export interface PromoteStorage {
  copy(from: string, to: string): Promise<{ error: { message: string } | null }>;
  remove(names: string[]): Promise<{ error: { message: string } | null }>;
}

export type PromoteResult =
  | { ok: true; warning?: string }
  | { ok: false; error: string; restored: boolean; stagedKept: boolean };

export async function promoteSameName(
  storage: PromoteStorage,
  opts: { staged: string; target: string; backup: string },
): Promise<PromoteResult> {
  const { staged, target, backup } = opts;

  const backedUp = await storage.copy(target, backup);
  if (backedUp.error) {
    // Original is untouched — safe to abort immediately.
    await storage.remove([staged]).catch(() => undefined);
    return {
      ok: false,
      error: `Could not back up the original: ${backedUp.error.message}`,
      restored: true,
      stagedKept: false,
    };
  }

  const removed = await storage.remove([target]);
  if (removed.error) {
    await storage.remove([backup]).catch(() => undefined);
    await storage.remove([staged]).catch(() => undefined);
    return {
      ok: false,
      error: `Could not replace the original: ${removed.error.message}`,
      restored: true,
      stagedKept: false,
    };
  }

  const promoted = await storage.copy(staged, target);
  if (promoted.error) {
    const restore = await storage.copy(backup, target);
    if (!restore.error) {
      await storage.remove([backup]).catch(() => undefined);
      await storage.remove([staged]).catch(() => undefined);
      return {
        ok: false,
        error: `Replacement failed and the original was restored: ${promoted.error.message}`,
        restored: true,
        stagedKept: false,
      };
    }
    // Worst case: the backup is the only surviving copy — keep it AND the staged upload,
    // and say so, rather than silently leaving a dead URL behind.
    return {
      ok: false,
      error:
        `Replacement failed (${promoted.error.message}) and the original could not be restored ` +
        `(${restore.error.message}). The original is preserved as "${backup}" and the new file as "${staged}".`,
      restored: false,
      stagedKept: true,
    };
  }

  // The swap succeeded. Removing the two service objects can still fail, and a leftover
  // backup-/staged- object shows up in the Library — report it instead of pretending the
  // bucket is clean. They are deliberately NOT hidden, so the bytes stay recoverable.
  const leftovers: string[] = [];
  for (const name of [backup, staged]) {
    const { error } = await storage.remove([name]).catch((e: unknown) => ({
      error: { message: (e as Error)?.message ?? "unknown error" },
    }));
    if (error) leftovers.push(`${name} (${error.message})`);
  }
  if (leftovers.length) {
    return {
      ok: true,
      warning: `Temporary object(s) could not be removed: ${leftovers.join(", ")}`,
    };
  }
  return { ok: true };
}

