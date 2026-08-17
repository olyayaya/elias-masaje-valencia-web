export type Locale = "es" | "en" | "ru";

export interface Translations {
  common: {
    loadError: string;
    retry: string;
    loading: string;
  };
  nav: {
    home: string;
    services: string;
    gallery: string;
    about: string;
    contact: string;
    blog: string;
    book: string;
    bookWhatsApp: string;
  };
  hero: {
    tagline: string;
  };
  benefits: {
    title: string;
    items: { title: string; description: string }[];
  };
  booking: {
    title: string;
    subtitle: string;
    serviceLabel: string;
    durationLabel: string;
    priceLabel: string;
    nameLabel: string;
    namePlaceholder: string;
    phoneLabel: string;
    phonePlaceholder: string;
    preferredLabel: string;
    preferredPlaceholder: string;
    errNameRequired: string;
    errNameShort: string;
    errNameLong: string;
    errPhoneRequired: string;
    errPhoneInvalid: string;
    errPreferredRequired: string;
    errPreferredShort: string;
    errPreferredLong: string;
    errFixFields: string;
    doneTitle: string;
    doneBody: string;
    doneCopiedTitle: string;
    doneCopiedBody: string;
    doneSummaryLabel: string;
    doneReopen: string;
    doneEdit: string;
    doneClose: string;
    previewLabel: string;
    greeting: string;
    closing: string;
    copyBtn: string;
    copied: string;
    copyFailed: string;
    openBtn: string;
    note: string;
  };
  services: {
    title: string;
    viewAll: string;
    pageSubtitle: string;
    bookBtn: string;
    sectionLabel: string;
    priceFrom: string;
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
    readMore: string;
    showLess: string;
    prev: string;
    next: string;
    ratingAria: string;
    carouselLabel: string;
    openOriginal: string;
  };
  location: {
    title: string;
  };
  faq: {
    title: string;
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
    hours: string;
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
  gallery: {
    title: string;
    subtitle: string;
    metaTitle: string;
    metaDescription: string;
    empty: string;
    playVideo: string;
    readMore: string;
    close: string;
    prev: string;
    next: string;
    viewer: string;
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
