/** Centralized contact details — single source of truth */
export const WHATSAPP_PHONE = "34698968007";
export const WHATSAPP_DEFAULT_MESSAGE = "Hola%2C%20me%20gustaría%20reservar%20una%20cita";
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_PHONE}?text=${WHATSAPP_DEFAULT_MESSAGE}`;

export const INSTAGRAM_HANDLE = "@elias_masaje";
export const INSTAGRAM_URL = `https://instagram.com/${INSTAGRAM_HANDLE.replace("@", "")}`;

/** Build a WhatsApp URL with a custom message */
export const whatsappUrl = (message: string) =>
  `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
