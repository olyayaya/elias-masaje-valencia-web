import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated } from "../supabase";

const BUSINESS_PHONE = "34698968007";

type Locale = "es" | "en" | "ru";

const TEMPLATES: Record<Locale, (v: Record<string, string>) => string> = {
  es: (v) =>
    `Hola ${v.name}, soy Elias (Elias Masaje).\n\nHe recibido tu solicitud de reserva:\n• Servicio: ${v.service}\n• Duración: ${v.duration}\n• Precio: ${v.price}\n• Horario preferido: ${v.preferred}\n\n¿Te viene bien confirmar esta cita?${v.note}\n\nUn saludo.`,
  en: (v) =>
    `Hi ${v.name}, this is Elias (Elias Masaje).\n\nI received your booking request:\n• Service: ${v.service}\n• Duration: ${v.duration}\n• Price: ${v.price}\n• Preferred time: ${v.preferred}\n\nShall we confirm this appointment?${v.note}\n\nBest regards.`,
  ru: (v) =>
    `Здравствуйте, ${v.name}! Это Элиас (Elias Masaje).\n\nЯ получил вашу заявку на запись:\n• Услуга: ${v.service}\n• Длительность: ${v.duration}\n• Цена: ${v.price}\n• Удобное время: ${v.preferred}\n\nПодтверждаем запись?${v.note}\n\nС уважением.`,
};

const NOT_SET: Record<Locale, string> = { es: "sin especificar", en: "not specified", ru: "не указано" };

const digitsOnly = (phone: string) => phone.replace(/[^\d]/g, "");

export default defineTool({
  name: "create_whatsapp_booking_request",
  title: "Create WhatsApp booking request",
  description:
    "Build a ready-to-send WhatsApp booking request message for an existing booking lead: returns the localized message text, a wa.me link to the client (and a fallback link to the business number), and the resulting lead status. Optionally marks the lead as contacted.",
  inputSchema: {
    leadId: z.string().uuid().describe("The booking lead id to build the WhatsApp request from."),
    locale: z.string().optional().describe("Message language: es, en or ru. Defaults to the lead's own locale."),
    note: z.string().optional().describe("Extra line appended to the message, e.g. an alternative time proposal."),
    markContacted: z
      .boolean()
      .optional()
      .describe("Set the lead status to 'contacted' after building the message (default true)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ leadId, locale, note, markContacted }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated;
    const supabase = supabaseForUser(ctx);

    const { data: lead, error } = await supabase
      .from("booking_leads")
      .select("id, name, phone, service, duration, price, preferred_time, message, location, locale, status")
      .eq("id", leadId)
      .maybeSingle();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!lead) return { content: [{ type: "text", text: `No booking lead found for id ${leadId}.` }], isError: true };

    const lang: Locale = (["es", "en", "ru"] as const).includes((locale ?? lead.locale) as Locale)
      ? ((locale ?? lead.locale) as Locale)
      : "es";
    const fallback = NOT_SET[lang];

    const message = TEMPLATES[lang]({
      name: lead.name ?? "",
      service: lead.service ?? fallback,
      duration: lead.duration ? `${lead.duration} min` : fallback,
      price: lead.price ? `${lead.price} €` : fallback,
      preferred: lead.preferred_time ?? fallback,
      note: note ? `\n\n${note}` : "",
    });

    const clientPhone = lead.phone ? digitsOnly(lead.phone) : "";
    const encoded = encodeURIComponent(message);
    const clientLink = clientPhone ? `https://wa.me/${clientPhone}?text=${encoded}` : null;
    const businessLink = `https://wa.me/${BUSINESS_PHONE}?text=${encoded}`;

    let status = lead.status;
    let statusUpdated = false;
    if (markContacted !== false && lead.status !== "contacted" && lead.status !== "booked") {
      const { data: updated, error: updateError } = await supabase
        .from("booking_leads")
        .update({ status: "contacted", updated_at: new Date().toISOString() })
        .eq("id", leadId)
        .select("status");
      if (updateError) {
        return {
          content: [
            { type: "text", text: `Message built, but the lead status could not be updated: ${updateError.message}` },
          ],
          isError: true,
        };
      }
      if (updated && updated.length > 0) {
        status = updated[0].status;
        statusUpdated = true;
      }
    }

    const result = {
      leadId: lead.id,
      locale: lang,
      clientName: lead.name,
      clientPhone: lead.phone ?? null,
      message,
      whatsappLink: clientLink,
      businessWhatsappLink: businessLink,
      status,
      statusUpdated,
      followUp:
        status === "contacted"
          ? "Lead marked as contacted — follow up if there is no reply within 24h, then set status to booked or closed."
          : `Lead status is '${status}'. Use update_booking_lead_status to move it forward.`,
    };

    return {
      content: [
        {
          type: "text",
          text: `${clientLink ? `Send: ${clientLink}\n\n` : "No client phone on this lead — use the business link.\n\n"}${message}\n\nStatus: ${status}${statusUpdated ? " (updated)" : ""}`,
        },
      ],
      structuredContent: result,
    };
  },
});
