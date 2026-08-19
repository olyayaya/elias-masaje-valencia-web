/**
 * Filename splitting for the Library rename dialog.
 *
 * The extension is never editable: the UI renders it as a read-only suffix and the
 * submitted name is always rebuilt as `base + originalExtension`. The media-guard
 * function re-checks the extension server-side, so this is a usability layer only.
 */

/** Splits on the LAST dot. `base` may be empty for dotfiles; `ext` includes the dot. */
export function splitFileName(name: string): { base: string; ext: string } {
  const m = name.match(/^(.*)(\.[^.]+)$/);
  if (!m) return { base: name, ext: "" };
  return { base: m[1], ext: m[2] };
}

/**
 * Cleans a value typed or pasted into the base field: paths are dropped and the
 * file's own extension is stripped so pasting the full name cannot yield `x.mp4.mp4`.
 */
export function sanitizeBaseInput(raw: string, ext: string): string {
  let value = raw.replace(/[\\/]/g, "").replace(/\.\./g, "");
  if (ext) {
    const lower = value.toLowerCase();
    while (lower.length && value.toLowerCase().endsWith(ext.toLowerCase())) {
      value = value.slice(0, -ext.length);
    }
  }
  return value;
}

/** Always rebuilds the target name from the sanitized base and the ORIGINAL extension. */
export function buildRenameName(base: string, ext: string): string {
  return `${base.trim()}${ext}`;
}
