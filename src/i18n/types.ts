export type Locale = "es" | "en" | "ru";

export interface Translations {
  nav: {
    home: string;
    services: string;
    about: string;
    contact: string;
    book: string;
    bookWhatsApp: string;
  };
  hero: {
    headline: string;
    subheadline: string;
    cta: string;
  };
  benefits: {
    title: string;
    items: { title: string; description: string }[];
  };
  services: {
    title: string;
    viewAll: string;
    pageSubtitle: string;
    bookBtn: string;
    items: { title: string; description: string; duration: string; price: string }[];
  };
  about: {
    title: string;
    previewP1: string;
    previewP2: string;
    learnMore: string;
    paragraphs: string[];
    spaceTitle: string;
    spaceParagraphs: string[];
  };
  testimonials: {
    title: string;
    items: { quote: string; name: string; source?: string }[];
  };
  location: {
    title: string;
  };
  faq: {
    title: string;
    items: { question: string; answer: string }[];
  };
  giftCard: {
    title: string;
    description: string;
    cta: string;
  };
  finalCta: {
    title: string;
    description: string;
    cta: string;
  };
  contact: {
    title: string;
    address: string;
    addressValue: string;
    hours: string;
    weekdays: string;
    saturday: string;
    sunday: string;
    whatsapp: string;
    sendMessage: string;
    instagram: string;
  };
  footer: {
    tagline: string;
    navigation: string;
    contact: string;
    rights: string;
  };
}
