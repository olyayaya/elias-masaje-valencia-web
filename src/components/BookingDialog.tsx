import { useEffect, useMemo, useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n/context";
import { whatsappUrl } from "@/config/contact";
import { trackWhatsAppClick } from "@/lib/analytics";
import { formatPrice } from "@/lib/format-price";
import { toast } from "sonner";

export interface BookingDialogProps {
  /** Service the visitor is booking */
  service: string;
  duration?: string;
  price?: string;
  /** Attribution label passed to analytics */
  location: string;
  /** Trigger button label + styling (keeps each call site's existing look) */
  triggerLabel: string;
  triggerClassName?: string;
  hidePrice?: boolean;
  hideDuration?: boolean;
  hidePriceFrom?: boolean;
}

const BookingDialog = ({
  service,
  duration,
  price,
  location,
  triggerLabel,
  triggerClassName,
  hidePrice,
  hideDuration,
  hidePriceFrom,
}: BookingDialogProps) => {
  const { t } = useI18n();
  const b = t.booking;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [preferred, setPreferred] = useState("");
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const [edited, setEdited] = useState(false);

  const shownDuration = !hideDuration ? (duration || "").trim() : "";
  const shownPrice = !hidePrice && price ? formatPrice(price, t, { hidePrefix: hidePriceFrom }) : "";

  /** The exact text sent to WhatsApp — always mirrors the preview box. */
  const generated = useMemo(() => {
    const lines = [b.greeting, ""];
    lines.push(`${b.serviceLabel}: ${service}`);
    if (shownDuration) lines.push(`${b.durationLabel}: ${shownDuration}`);
    if (shownPrice) lines.push(`${b.priceLabel}: ${shownPrice}`);
    if (name.trim()) lines.push(`${b.nameLabel}: ${name.trim()}`);
    if (preferred.trim()) lines.push(`${b.preferredLabel}: ${preferred.trim()}`);
    lines.push("", b.closing);
    return lines.join("\n");
  }, [b, service, shownDuration, shownPrice, name, preferred]);

  // Keep the preview in sync until the visitor edits it by hand.
  useEffect(() => {
    if (!edited) setMessage(generated);
  }, [generated, edited]);

  // Reset per-open state so a second service never inherits the first message.
  useEffect(() => {
    if (open) {
      setEdited(false);
      setCopied(false);
      setMessage(generated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast.success(b.copied);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(b.copyFailed);
    }
  };

  const openWhatsApp = async () => {
    // Copy the exact preview first so it can be pasted if WhatsApp drops the text.
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      /* clipboard is optional — never block the booking */
    }
    trackWhatsAppClick(location, {
      service_name: service,
      duration: shownDuration || undefined,
      price: shownPrice || undefined,
      customized: edited,
    });
    window.open(whatsappUrl(message), "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className={triggerClassName}>
          {triggerLabel}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{b.title}</DialogTitle>
          <DialogDescription className="font-body">{b.subtitle}</DialogDescription>
        </DialogHeader>

        <div className="rounded border border-border bg-muted/40 p-4 font-body text-sm space-y-1">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{b.serviceLabel}</span>
            <span className="font-medium text-right">{service}</span>
          </div>
          {shownDuration && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{b.durationLabel}</span>
              <span className="font-medium text-right">{shownDuration}</span>
            </div>
          )}
          {shownPrice && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{b.priceLabel}</span>
              <span className="font-medium text-right">{shownPrice}</span>
            </div>
          )}
        </div>

        <div className="grid gap-3 font-body">
          <div className="grid gap-1.5">
            <Label htmlFor="booking-name" className="text-xs">{b.nameLabel}</Label>
            <Input
              id="booking-name"
              value={name}
              onChange={(e) => { setName(e.target.value); setEdited(false); }}
              placeholder={b.namePlaceholder}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="booking-when" className="text-xs">{b.preferredLabel}</Label>
            <Input
              id="booking-when"
              value={preferred}
              onChange={(e) => { setPreferred(e.target.value); setEdited(false); }}
              placeholder={b.preferredPlaceholder}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="booking-message" className="text-xs">{b.previewLabel}</Label>
            <Textarea
              id="booking-message"
              value={message}
              onChange={(e) => { setMessage(e.target.value); setEdited(true); }}
              rows={7}
              className="text-sm leading-relaxed"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={copy}
            className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-body border border-border rounded px-4 py-2.5 transition-colors hover:bg-muted"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? b.copied : b.copyBtn}
          </button>
          <button
            type="button"
            onClick={openWhatsApp}
            className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-body bg-primary text-primary-foreground rounded px-4 py-2.5 transition-opacity hover:opacity-90"
          >
            <MessageCircle className="h-4 w-4" />
            {b.openBtn}
          </button>
        </div>
        <p className="text-xs text-muted-foreground font-body">{b.note}</p>
      </DialogContent>
    </Dialog>
  );
};

export default BookingDialog;
