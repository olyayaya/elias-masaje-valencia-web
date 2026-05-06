import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardCard from "./DashboardCard";
import ImagePicker from "./ImagePicker";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Trash2, ChevronUp, ChevronDown, Loader2, ImageIcon, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface PageImage {
  id: string;
  collection_key: string;
  image_url: string;
  alt_text: string;
  sort_order: number;
}

const COLLECTIONS: { key: string; label: string; description: string }[] = [
  { key: "home_carousel", label: "Homepage Carousel", description: "Image carousel on the landing page services section" },
  { key: "services_carousel", label: "Services Page Carousel", description: "Carousel shown on the /servicios page" },
  { key: "about_carousel", label: "About Me Gallery", description: "Image carousel on the /sobre-mi page" },
];

const CollectionSection = ({
  collection,
  images,
  onChange,
}: {
  collection: { key: string; label: string; description: string };
  images: PageImage[];
  onChange: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [pickerForId, setPickerForId] = useState<string | null>(null);
  const [pickerForNew, setPickerForNew] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const d: Record<string, string> = {};
    images.forEach((i) => (d[i.id] = i.alt_text));
    setDrafts(d);
  }, [images]);

  const addImage = async (url: string) => {
    setBusy("new");
    const nextOrder = images.length ? Math.max(...images.map((i) => i.sort_order)) + 1 : 0;
    const { error } = await supabase.from("page_images").insert({
      collection_key: collection.key,
      image_url: url,
      alt_text: "",
      sort_order: nextOrder,
    });
    if (error) toast.error("Failed to add image");
    else {
      toast.success("Image added");
      onChange();
    }
    setBusy(null);
  };

  const updateUrl = async (id: string, url: string) => {
    setBusy(id);
    const { error } = await supabase.from("page_images").update({ image_url: url }).eq("id", id);
    if (error) toast.error("Failed to update");
    else {
      toast.success("Image updated");
      onChange();
    }
    setBusy(null);
  };

  const updateAlt = async (img: PageImage) => {
    if (drafts[img.id] === img.alt_text) return;
    setBusy(img.id + "-alt");
    const { error } = await supabase.from("page_images").update({ alt_text: drafts[img.id] }).eq("id", img.id);
    if (error) toast.error("Failed to save");
    else toast.success("Alt text saved");
    setBusy(null);
    onChange();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this image from the carousel?")) return;
    setBusy(id);
    const { error } = await supabase.from("page_images").delete().eq("id", id);
    if (error) toast.error("Failed to remove");
    else {
      toast.success("Removed");
      onChange();
    }
    setBusy(null);
  };

  const move = async (img: PageImage, direction: -1 | 1) => {
    const sorted = [...images].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((i) => i.id === img.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    setBusy(img.id);
    await supabase.from("page_images").update({ sort_order: other.sort_order }).eq("id", img.id);
    await supabase.from("page_images").update({ sort_order: img.sort_order }).eq("id", other.id);
    setBusy(null);
    onChange();
  };

  const sorted = [...images].sort((a, b) => a.sort_order - b.sort_order);
  const usingDefaults = sorted.length === 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full text-left">
        <DashboardCard title={collection.label} description={collection.description}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
            <ChevronRight size={14} className={`transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
            <span>
              {usingDefaults
                ? "Using built-in default images — add one to override"
                : `${sorted.length} image${sorted.length === 1 ? "" : "s"}`}
            </span>
          </div>
        </DashboardCard>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border border-t-0 border-border rounded-b-lg bg-card px-5 pb-5 pt-3 space-y-3">
          {sorted.map((img, i) => (
            <div key={img.id} className="flex gap-3 items-start p-3 rounded-lg bg-secondary/40">
              <div className="w-20 h-20 rounded-md overflow-hidden bg-background shrink-0">
                <img src={img.image_url} alt={img.alt_text} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 space-y-1.5 min-w-0">
                <div className="flex gap-1.5">
                  <Input
                    value={img.image_url}
                    readOnly
                    className="text-xs font-mono"
                  />
                  <Button size="sm" variant="outline" onClick={() => setPickerForId(img.id)} className="h-10 shrink-0">
                    <ImageIcon size={14} />
                  </Button>
                </div>
                <div className="flex gap-1.5">
                  <Input
                    value={drafts[img.id] ?? ""}
                    onChange={(e) => setDrafts((p) => ({ ...p, [img.id]: e.target.value }))}
                    onBlur={() => updateAlt(img)}
                    placeholder="Alt text (for SEO & accessibility)"
                    className="text-sm"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => move(img, -1)} disabled={i === 0 || !!busy} className="h-7 w-7 p-0">
                  <ChevronUp size={14} />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => move(img, 1)} disabled={i === sorted.length - 1 || !!busy} className="h-7 w-7 p-0">
                  <ChevronDown size={14} />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(img.id)} disabled={!!busy} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                  {busy === img.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </Button>
              </div>
            </div>
          ))}

          <Button size="sm" variant="outline" onClick={() => setPickerForNew(true)} disabled={busy === "new"} className="w-full">
            {busy === "new" ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Plus size={14} className="mr-1.5" />}
            Add image
          </Button>
        </div>
      </CollapsibleContent>

      <ImagePicker
        open={pickerForNew}
        onClose={() => setPickerForNew(false)}
        onSelect={(url) => addImage(url)}
      />
      <ImagePicker
        open={!!pickerForId}
        onClose={() => setPickerForId(null)}
        onSelect={(url) => pickerForId && updateUrl(pickerForId, url)}
        currentUrl={pickerForId ? images.find((i) => i.id === pickerForId)?.image_url : undefined}
      />
    </Collapsible>
  );
};

const DashboardCarousels = () => {
  const [images, setImages] = useState<PageImage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    const { data } = await supabase.from("page_images").select("*").order("sort_order", { ascending: true });
    if (data) setImages(data as PageImage[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Manage the photo carousels shown across the site. Empty carousels fall back to the built-in default images.
      </p>
      {COLLECTIONS.map((col) => (
        <CollectionSection
          key={col.key}
          collection={col}
          images={images.filter((i) => i.collection_key === col.key)}
          onChange={fetchAll}
        />
      ))}
    </div>
  );
};

export default DashboardCarousels;
