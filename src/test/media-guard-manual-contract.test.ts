/**
 * The deployed media-guard has no vitest runtime, so its manual-mode contract is asserted
 * against the function source that is deployed verbatim: mode:"manual" may bypass ONLY the
 * saving threshold — auth/role, name, MIME + magic bytes, size, container and the
 * transactional reference rewrite must stay unconditional.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const src = readFileSync("supabase/functions/media-guard/index.ts", "utf8");

describe("media-guard manual mode contract", () => {
  it("reads an explicit mode and only treats \"manual\" as manual", () => {
    expect(src).toMatch(/body\?\.mode === "manual" \? "manual" : "smart"/);
  });

  it("photo replace: manual short-circuits evaluateSaving and nothing else", () => {
    expect(src).toMatch(/replaceMode === "manual"\s*\?\s*\{ ok: true \}\s*:\s*evaluateSaving\(/);
    // The unconditional safety checks all sit BEFORE the saving verdict.
    const verdictAt = src.indexOf("const replaceMode = readMode(body)");
    for (const guard of ["validateOutputType(contentType, newName)", "magicMatches(contentType, bytes)", "MAX_UPLOAD_BYTES"]) {
      expect(src.indexOf(guard)).toBeGreaterThan(-1);
      expect(src.indexOf(guard)).toBeLessThan(verdictAt);
    }
  });

  it("commit-video: manual only disables the saving enforcement flag", () => {
    expect(src).toMatch(/const enforceSaving = mode === "smart" && body\?\.enforceSaving !== false/);
    expect(src).toMatch(/if \(enforceSaving\) \{\s*const verdict = evaluateSaving\(/);
  });

  it("keeps auth, admin role, container, size and gallery guards unconditional", () => {
    expect(src).toMatch(/if \(!authHeader\.startsWith\("Bearer "\)\) return json\(\{ error: "Unauthorized" \}, 401\)/);
    expect(src).toMatch(/if \(!isAdmin\) return json\(\{ error: "Forbidden — admin only" \}, 403\)/);
    expect(src).toMatch(/videoMagicMatches\(contentType, head\)/);
    expect(src).toMatch(/staged\.size > MAX_VIDEO_BYTES/);
    expect(src).toMatch(/isGalleryPublishable\(newName\)/);
    expect(src).toMatch(/validateStagedName\(stagedName, user\.id/);
    // Reference rewriting stays a single transactional RPC.
    expect(src).toMatch(/admin\.rpc\("rewrite_media_references"/);
  });

  it("removes the staged video whenever a server-side check fails", () => {
    expect(src).toMatch(/const cleanup = async \(\) => \{ await admin\.storage\.from\("media"\)\.remove\(\[stagedName\]\); \}/);
  });
});
