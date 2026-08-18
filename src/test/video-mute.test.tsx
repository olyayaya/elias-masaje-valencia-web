/**
 * "Remove audio before upload" (Dashboard → Library).
 *
 * The contract under test: when the option is on, the ONLY bytes that reach storage are the
 * locally muted remux — a failure, cancellation or unsupported browser skips the file instead
 * of falling back to the original with sound. Images never touch the video path, and the
 * ffmpeg core stays unloaded while the option is off.
 */
import { describe, it, expect } from "vitest";
import { buildStripAudioArgs, logHasAudioStream } from "@/lib/video-convert";

// ---------------------------------------------------------------------------
// pure argv / log parsing
// ---------------------------------------------------------------------------
describe("strip-audio ffmpeg command", () => {
  it("copies the video stream and drops audio without re-encoding", () => {
    const args = buildStripAudioArgs({ inputName: "mute-in.mp4", outputName: "mute-out.mp4" });
    expect(args).toEqual([
      "-i", "mute-in.mp4", "-map", "0:v:0", "-c:v", "copy", "-an", "-sn", "-dn",
      "-movflags", "+faststart", "-f", "mp4", "-y", "mute-out.mp4",
    ]);
    // No quality knobs at all: no CRF, no scaling, no video encoder.
    expect(args).not.toContain("-crf");
    expect(args).not.toContain("libx264");
    expect(args).not.toContain("-vf");
  });

  it("forces the ISO BMFF muxer for .m4v instead of raw MPEG-4 video", () => {
    const args = buildStripAudioArgs({ inputName: "a-in.m4v", outputName: "a-out.m4v" });
    expect(args[args.indexOf("-f") + 1]).toBe("mp4");
    expect(args).toContain("-movflags");
    expect(args.at(-1)).toBe("a-out.m4v");
  });

  it("uses the mov muxer for QuickTime sources", () => {
    const args = buildStripAudioArgs({ inputName: "a-in.mov", outputName: "a-out.mov" });
    expect(args[args.indexOf("-f") + 1]).toBe("mov");
  });

  it("keeps the source container and omits mov-only flags for WebM", () => {
    const args = buildStripAudioArgs({ inputName: "mute-in.webm", outputName: "mute-out.webm" });
    expect(args).not.toContain("-movflags");
    expect(args[args.indexOf("-f") + 1]).toBe("webm");
    expect(args.at(-1)).toBe("mute-out.webm");
  });


  it("detects whether the source had an audio stream", () => {
    expect(logHasAudioStream("Stream #0:1(eng): Audio: aac (LC), 48000 Hz")).toBe(true);
    expect(logHasAudioStream("Stream #0:0: Video: h264 (High)")).toBe(false);
  });
});
