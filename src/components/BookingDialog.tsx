import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { ArrowLeft, Check, CheckCircle2, Copy, MessageCircle } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/i18n/context";
import { whatsappUrl } from "@/config/contact";
import { trackWhatsAppClick } from "@/lib/analytics";
import { formatPrice } from "@/lib/format-price";
import { parseServiceTiers } from "@/lib/service-tiers";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
  const [phone, setPhone] = useState("");
  const [copied, setCopied] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; phone?: string; preferred?: string }>({});
  const [touched, setTouched] = useState<{ name?: boolean; phone?: boolean; preferred?: boolean }>({});
  const [message, setMessage] = useState("");
  const [edited, setEdited] = useState(false);
  const [done, setDone] = useState<null | "opened" | "copied">(null);
  const [tierIndex, setTierIndex] = useState(0);

  /** Strict validation — runs before WhatsApp ever opens. */
  const schema = useMemo(() => z.object({
    name: z.string().trim()
      .nonempty({ message: b.errNameRequired })
      .min(2, { message: b.errNameShort })
      .max(60, { message: b.errNameLong })
      .regex(/^[\p{L}\p{M}'’\-. ]+$/u, { message: b.errNameShort }),
    phone: z.string().trim()
      .nonempty({ message: b.errPhoneRequired })
      .max(20, { message: b.errPhoneInvalid })
      .regex(/^\+?[0-9][0-9\s().-]{7,18}$/, { message: b.errPhoneInvalid })
      .refine((v) => {
        const digits = v.replace(/\D/g, "").length;
        return digits >= 9 && digits <= 15;
      }, { message: b.errPhoneInvalid }),
    preferred: z.string().trim()
      .nonempty({ message: b.errPreferredRequired })
      .min(3, { message: b.errPreferredShort })
      .max(100, { message: b.errPreferredLong }),
  }), [b]);

  const validate = (showAll = false) => {
    const result = schema.safeParse({ name, phone, preferred });
    if (result.success) {
      setErrors({});
      return result.data;
    }
    const next: { name?: string; phone?: string; preferred?: string } = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as "name" | "phone" | "preferred";
      if (!next[key] && (showAll || touched[key])) next[key] = issue.message;
    }
    setErrors(next);
    if (showAll) setTouched({ name: true, phone: true, preferred: true });
    return null;
  };

  /** Durations/prices are stored as parallel "a / b / c" strings — pair by index. */
  const tiers = useMemo(() => parseServiceTiers(duration, price), [duration, price]);
  const selectedTier = tiers[tierIndex] ?? tiers[0];

  const shownDuration = hideDuration
    ? ""
    : (selectedTier?.duration ?? (duration || "").trim());
  const rawPrice = selectedTier?.price ?? price;
  const shownPrice = !hidePrice && rawPrice
    ? formatPrice(rawPrice, t, { hidePrefix: hidePriceFrom })
    : "";

  /** The exact text sent to WhatsApp — always mirrors the preview box. */
  const generated = useMemo(() => {
    const lines = [b.greeting, ""];
    lines.push(`${b.serviceLabel}: ${service}`);
    if (shownDuration) lines.push(`${b.durationLabel}: ${shownDuration}`);
    if (shownPrice) lines.push(`${b.priceLabel}: ${shownPrice}`);
    if (name.trim()) lines.push(`${b.nameLabel}: ${name.trim()}`);
    if (phone.trim()) lines.push(`${b.phoneLabel}: ${phone.trim()}`);
    if (preferred.trim()) lines.push(`${b.preferredLabel}: ${preferred.trim()}`);
    lines.push("", b.closing);
    return lines.join("\n");
  }, [b, service, shownDuration, shownPrice, name, phone, preferred]);

  // Re-validate as the visitor types, but only surface errors for touched fields.
  useEffect(() => {
    const result = schema.safeParse({ name, phone, preferred });
    if (result.success) { setErrors({}); return; }
    const next: { name?: string; phone?: string; preferred?: string } = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as "name" | "phone" | "preferred";
      if (!next[key] && touched[key]) next[key] = issue.message;
    }
    setErrors(next);
  }, [name, phone, preferred, touched, schema]);

  // Keep the preview in sync until the visitor edits it by hand.
  useEffect(() => {
    if (!edited) setMessage(generated);
  }, [generated, edited]);

  // Reset per-open state so a second service never inherits the first message.
  useEffect(() => {
    if (open) {
      setEdited(false);
      setCopied(false);
      setErrors({});
      setTouched({});
      setDone(null);
      setTierIndex(0);
      setMessage(generated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Never let a duration/price selection leak to a different service.
  useEffect(() => {
    setTierIndex(0);
  }, [service, duration, price]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast.success(b.copied);
      setDone((prev) => prev ?? "copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(b.copyFailed);
    }
  };

  const openWhatsApp = async () => {
    const data = validate(true);
    if (!data) {
      toast.error(b.errFixFields);
      return;
    }

    // Save the lead so the request is never lost if the WhatsApp chat is abandoned.
    void supabase.from("booking_leads").insert([{
      name: data.name,
      phone: data.phone,
      preferred_time: data.preferred,
      service,
      duration: shownDuration || null,
      price: shownPrice || null,
      message: message.slice(0, 1000),
      location,
      page_path: typeof window !== "undefined" ? window.location.pathname + window.location.search : null,
      locale: typeof document !== "undefined" ? document.documentElement.lang || null : null,
    }]).then(({ error }) => {
      if (error) console.warn("booking lead not saved", error.message);
    });
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
    setDone("opened");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className={triggerClassName}>
          {triggerLabel}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        {done ? (
          <div className="font-body">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-primary" aria-hidden="true" />
                {done === "opened" ? b.doneTitle : b.doneCopiedTitle}
              </DialogTitle>
              <DialogDescription className="font-body">
                {done === "opened" ? b.doneBody : b.doneCopiedBody}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 rounded border border-border bg-muted/40 p-4 text-sm space-y-1" aria-live="polite">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{b.doneSummaryLabel}</p>
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
              {preferred.trim() && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{b.preferredLabel}</span>
                  <span className="font-medium text-right">{preferred.trim()}</span>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => setDone(null)}
                className="flex-1 inline-flex items-center justify-center gap-2 text-sm border border-border rounded px-4 py-2.5 transition-colors hover:bg-muted"
              >
                <ArrowLeft className="h-4 w-4" />
                {b.doneEdit}
              </button>
              <button
                type="button"
                onClick={openWhatsApp}
                className="flex-1 inline-flex items-center justify-center gap-2 text-sm bg-primary text-primary-foreground rounded px-4 py-2.5 transition-opacity hover:opacity-90"
              >
                <MessageCircle className="h-4 w-4" />
                {b.doneReopen}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-2 w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              {b.doneClose}
            </button>
          </div>
        ) : (
        <>
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
          {!hideDuration && tiers.length > 1 && (
            <div className="grid gap-1.5">
              <Label htmlFor="booking-duration" className="text-xs">{b.durationLabel}</Label>
              <Select
                value={String(tierIndex)}
                onValueChange={(v) => { setTierIndex(Number(v)); setEdited(false); }}
              >
                <SelectTrigger id="booking-duration" aria-label={b.durationLabel}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tiers.map((tier, i) => (
                    <SelectItem key={`${tier.duration}-${i}`} value={String(i)}>
                      {hidePrice || !tier.price
                        ? tier.duration
                        : `${tier.duration} — ${formatPrice(tier.price, t, { hidePrefix: true })}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-1.5">

            <Label htmlFor="booking-name" className="text-xs">{b.nameLabel}</Label>
            <Input
              id="booking-name"
              value={name}
              maxLength={60}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "booking-name-error" : undefined}
              onBlur={() => setTouched((p) => ({ ...p, name: true }))}
              onChange={(e) => { setName(e.target.value); setEdited(false); }}
              placeholder={b.namePlaceholder}
              className={errors.name ? "border-destructive focus-visible:ring-destructive" : undefined}
            />
            {errors.name && (
              <p id="booking-name-error" role="alert" className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="booking-phone" className="text-xs">{b.phoneLabel}</Label>
            <Input
              id="booking-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              maxLength={20}
              aria-invalid={!!errors.phone}
              aria-describedby={errors.phone ? "booking-phone-error" : undefined}
              onBlur={() => setTouched((p) => ({ ...p, phone: true }))}
              onChange={(e) => { setPhone(e.target.value); setEdited(false); }}
              placeholder={b.phonePlaceholder}
              className={errors.phone ? "border-destructive focus-visible:ring-destructive" : undefined}
            />
            {errors.phone && (
              <p id="booking-phone-error" role="alert" className="text-xs text-destructive">{errors.phone}</p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="booking-when" className="text-xs">{b.preferredLabel}</Label>
            <Input
              id="booking-when"
              value={preferred}
              maxLength={100}
              aria-invalid={!!errors.preferred}
              aria-describedby={errors.preferred ? "booking-when-error" : undefined}
              onBlur={() => setTouched((p) => ({ ...p, preferred: true }))}
              onChange={(e) => { setPreferred(e.target.value); setEdited(false); }}
              placeholder={b.preferredPlaceholder}
              className={errors.preferred ? "border-destructive focus-visible:ring-destructive" : undefined}
            />
            {errors.preferred && (
              <p id="booking-when-error" role="alert" className="text-xs text-destructive">{errors.preferred}</p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="booking-message" className="text-xs">{b.previewLabel}</Label>
            <Textarea
              id="booking-message"
              value={message}
              maxLength={1000}
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
        </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BookingDialog;
