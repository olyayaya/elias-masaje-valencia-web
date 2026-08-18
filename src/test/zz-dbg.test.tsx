import { describe, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
vi.mock("sonner", () => ({ toast: { error: (...a:unknown[])=>console.log("TOASTERR",a), success: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock("@/lib/media-usage", () => ({ replaceMediaFile: vi.fn(), commitVideoReplacement: vi.fn() }));
vi.mock("@/lib/video-upload", () => ({ uploadResumable: vi.fn(), stagedObjectName: vi.fn(), removeObject: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { storage: { from: () => ({ upload: vi.fn() }) } } }));
vi.mock("@/lib/photo-encode", async (io) => {
  const actual = await io<typeof import("@/lib/photo-encode")>();
  return { ...actual, probePhotoCaps: () => ({ webp: true, jpg: true, png: true }),
    loadImageElement: vi.fn(async (b: Blob) => { console.log("DECODE", (b as File).name); return { naturalWidth: 111, naturalHeight: 222 } as HTMLImageElement; }) };
});
import MediaProcessingDialog from "@/components/dashboard/MediaProcessingDialog";
import { makeL } from "@/components/dashboard/media/i18n";
describe("dbg", () => { it("x", async () => {
  URL.createObjectURL = vi.fn(() => "blob:m"); URL.revokeObjectURL = vi.fn();
  render(<MediaProcessingDialog items={[{ id:"a", file:new File([new Uint8Array(10)],"hero.webp",{type:"image/webp"}), kind:"photo", replace:{name:"hero.webp",size:10} }]} L={makeL("en")} existingNames={[]} onClose={vi.fn()} onApplied={vi.fn()} />);
  fireEvent.change(document.querySelector('[data-testid="replace-file-input"]') as HTMLInputElement, { target: { files: [new File([new Uint8Array(10)],"b.jpg",{type:"image/jpeg"})] } });
  await new Promise(r=>setTimeout(r,300));
  console.log("LINE", screen.getByText(/File 1 of 1/).textContent);
}); });
