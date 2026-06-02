export type Locale = "es" | "en" | "ru";

export interface Translations {
  nav: {
    home: string;
    services: string;
    about: string;
    contact: string;
    blog: string;
    book: string;
    bookWhatsApp: string;
  };
  hero: {
    headline: string;
    subheadline: string;
    cta: string;
    tagline: string;
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
    sectionLabel: string;
    priceFrom: string;
    items: { title: string; description: string; duration: string; price: string }[];
  };
  about: {
    title: string;
    sectionLabel: string;
    previewP1: string;
    previewP2: string;
    learnMore: string;
    paragraphs: string[];
    spaceTitle: string;
    spaceLabel: string;
    spaceParagraphs: string[];
    gallery: string;
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
    sectionLabel: string;
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
  map: {
    openIn: string;
    cancel: string;
  };
  footer: {
    tagline: string;
    navigation: string;
    contact: string;
    rights: string;
  };
  a11y: {
    skipToContent: string;
    mainNavigation: string;
    footerNavigation: string;
    changeLanguage: string;
    toggleMenu: string;
    openMaps: string;
    whatsappBook: string;
  };
  cookies: {
    banner: {
      body: string;
      accept: string;
      reject: string;
      preferences: string;
      policyLink: string;
    };
    panel: {
      title: string;
      description: string;
      save: string;
      cancel: string;
      alwaysOn: string;
      necessary: { title: string; body: string };
      preferences: { title: string; body: string };
      analytics: { title: string; body: string };
      marketing: { title: string; body: string };
    };
    privacy: {
      pageTitle: string;
      heading: string;
      placeholder: string;
    };
  };
}
