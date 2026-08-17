import { Search, SlidersHorizontal, RotateCcw, ScanSearch, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_FILTERS, isDefaultFilters, type MediaFilters, type SortKey,
} from "@/lib/media-filters";
import type { LibraryT } from "./media/i18n";

interface Props {
  filters: MediaFilters;
  onChange: (next: MediaFilters) => void;
  extensions: string[];
  L: LibraryT;
  open: boolean;
  onToggle: () => void;
  usageLoaded: boolean;
  usageLoading: boolean;
  onScanUsage: () => void;
}

const SORTS: SortKey[] = ["newest", "oldest", "nameAsc", "nameDesc", "sizeDesc", "sizeAsc"];

/** Search + advanced filters for the Library. Purely presentational: all logic is in media-filters. */
const MediaFilterBar = ({
  filters, onChange, extensions, L, open, onToggle, usageLoaded, usageLoading, onScanUsage,
}: Props) => {
  const set = <K extends keyof MediaFilters>(key: K, value: MediaFilters[K]) =>
    onChange({ ...filters, [key]: value });

  const toggleExt = (ext: string) =>
    set("exts", filters.exts.includes(ext) ? filters.exts.filter((e) => e !== ext) : [...filters.exts, ext]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[12rem]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.q}
            onChange={(e) => set("q", e.target.value)}
            placeholder={L("search")}
            aria-label={L("search")}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={onToggle} aria-expanded={open}>
          <SlidersHorizontal size={14} className="mr-1" />
          {L("filters")}
        </Button>
        <Select value={filters.sort} onValueChange={(v) => set("sort", v as SortKey)}>
          <SelectTrigger className="w-[11rem]" aria-label={L("sortBy")}><SelectValue /></SelectTrigger>
          <SelectContent>
            {SORTS.map((s) => (
              <SelectItem key={s} value={s}>{L(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!isDefaultFilters(filters) && (
          <Button variant="ghost" size="sm" onClick={() => onChange({ ...DEFAULT_FILTERS, kind: filters.kind })}>
            <RotateCcw size={14} className="mr-1" />
            {L("reset")}
          </Button>
        )}
      </div>

      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-border rounded-lg p-4">
          <div className="space-y-2 sm:col-span-2">
            <Label className="text-xs">{L("fileType")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {extensions.map((ext) => {
                const on = filters.exts.includes(ext);
                return (
                  <button
                    key={ext}
                    type="button"
                    onClick={() => toggleExt(ext)}
                    aria-pressed={on}
                    className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
                  >
                    <Badge variant={on ? "default" : "outline"} className="cursor-pointer">.{ext}</Badge>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">{L("sizeRange")}</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number" min={0} inputMode="decimal"
                value={filters.minMB} onChange={(e) => set("minMB", e.target.value)}
                placeholder={L("min")} aria-label={`${L("sizeRange")} ${L("min")}`}
              />
              <span className="text-muted-foreground">—</span>
              <Input
                type="number" min={0} inputMode="decimal"
                value={filters.maxMB} onChange={(e) => set("maxMB", e.target.value)}
                placeholder={L("max")} aria-label={`${L("sizeRange")} ${L("max")}`}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">{L("dateRange")}</Label>
            <div className="flex items-center gap-2">
              <Input type="date" value={filters.from} onChange={(e) => set("from", e.target.value)} aria-label={`${L("dateRange")} ${L("min")}`} />
              <span className="text-muted-foreground">—</span>
              <Input type="date" value={filters.to} onChange={(e) => set("to", e.target.value)} aria-label={`${L("dateRange")} ${L("max")}`} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="flt-usage" className="text-xs">{L("usage")}</Label>
            <Select value={filters.usage} onValueChange={(v) => set("usage", v as MediaFilters["usage"])}>
              <SelectTrigger id="flt-usage"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{L("all")}</SelectItem>
                <SelectItem value="used">{L("used")}</SelectItem>
                <SelectItem value="unused">{L("unused")}</SelectItem>
                <SelectItem value="unknown">{L("unknownUsage")}</SelectItem>
              </SelectContent>
            </Select>
            {!usageLoaded && (
              <Button variant="outline" size="sm" onClick={onScanUsage} disabled={usageLoading} className="w-full">
                {usageLoading ? <Loader2 size={14} className="mr-1 animate-spin" /> : <ScanSearch size={14} className="mr-1" />}
                {usageLoading ? L("checkingUsage") : L("checkUsage")}
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="flt-opt" className="text-xs">{L("optimization")}</Label>
            <Select value={filters.opt} onValueChange={(v) => set("opt", v as MediaFilters["opt"])}>
              <SelectTrigger id="flt-opt"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{L("all")}</SelectItem>
                <SelectItem value="optimized">{L("optimized")}</SelectItem>
                <SelectItem value="canOptimize">{L("canOptimize")}</SelectItem>
                <SelectItem value="notAnalyzed">{L("notAnalyzed")}</SelectItem>
                <SelectItem value="unsupported">{L("unsupported")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaFilterBar;
