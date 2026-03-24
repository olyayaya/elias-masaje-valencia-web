import { Locale } from "./types";

export interface DashboardTranslations {
  welcome: string;
  siteOverview: string;
  manageYourSite: string;
  tip: string;
  tipText: string;
  backToSite: string;
  siteManager: string;
  sections: {
    overview: string;
    services: string;
    content: string;
    promotions: string;
    blog: string;
    seo: string;
    media: string;
    faq: string;
    testimonials: string;
    history: string;
  };
  overview: {
    monthlyViews: string;
    googleRanking: string;
    reviews: string;
    languages: string;
    servicesActive: string;
    promotionsActive: string;
    siteContentFields: string;
    blogPosts: string;
    blogDraft: string;
    faqQuestions: string;
    testimonialsReviews: string;
    mediaFiles: string;
    seoOverview: string;
    servicesDesc: string;
    promotionsDesc: string;
    contentDesc: string;
    blogDesc: string;
    faqDesc: string;
    testimonialsDesc: string;
    mediaDesc: string;
    seoDesc: string;
  };
}

const en: DashboardTranslations = {
  welcome: "Welcome back",
  siteOverview: "Here's an overview of your site. Click any section to manage it.",
  manageYourSite: "Manage your site",
  tip: "💡 Tip",
  tipText: "Use the Blog section to generate SEO-optimized posts with AI — it writes in your brand voice and targets Valencia search terms automatically.",
  backToSite: "Back to site",
  siteManager: "Site Manager",
  sections: {
    overview: "Overview",
    services: "Services",
    content: "Site Content",
    promotions: "Promotions",
    blog: "Blog",
    seo: "SEO",
    media: "Media",
    faq: "FAQ",
    testimonials: "Testimonials",
    history: "History",
  },
  overview: {
    monthlyViews: "Monthly views",
    googleRanking: "Google ranking",
    reviews: "Reviews",
    languages: "Languages",
    servicesActive: "active",
    promotionsActive: "active",
    siteContentFields: "fields",
    blogPosts: "posts",
    blogDraft: "draft",
    faqQuestions: "questions",
    testimonialsReviews: "reviews",
    mediaFiles: "files",
    seoOverview: "Overview",
    servicesDesc: "Manage your massage offerings, prices, and descriptions",
    promotionsDesc: "Add badges like \"Most popular\" or time-limited offers to services",
    contentDesc: "Edit hero text, CTAs, contact info, and section copy",
    blogDesc: "Write and manage SEO-optimized blog posts with AI",
    faqDesc: "Update frequently asked questions shown on the site",
    testimonialsDesc: "Manage client testimonials and ratings",
    mediaDesc: "Upload and organize images for your site",
    seoDesc: "Check search performance, keywords, and local SEO tips",
  },
};

const es: DashboardTranslations = {
  welcome: "Bienvenido de nuevo",
  siteOverview: "Aquí tienes un resumen de tu sitio. Haz clic en cualquier sección para gestionarla.",
  manageYourSite: "Gestiona tu sitio",
  tip: "💡 Consejo",
  tipText: "Usa la sección de Blog para generar posts optimizados para SEO con IA — escribe con la voz de tu marca y se dirige a términos de búsqueda de Valencia automáticamente.",
  backToSite: "Volver al sitio",
  siteManager: "Gestor del sitio",
  sections: {
    overview: "Inicio",
    services: "Servicios",
    content: "Contenido",
    promotions: "Promociones",
    blog: "Blog",
    seo: "SEO",
    media: "Medios",
    faq: "Preguntas frecuentes",
    testimonials: "Testimonios",
    history: "Historial",
  },
  overview: {
    monthlyViews: "Visitas mensuales",
    googleRanking: "Posición en Google",
    reviews: "Reseñas",
    languages: "Idiomas",
    servicesActive: "activos",
    promotionsActive: "activas",
    siteContentFields: "campos",
    blogPosts: "posts",
    blogDraft: "borrador",
    faqQuestions: "preguntas",
    testimonialsReviews: "reseñas",
    mediaFiles: "archivos",
    seoOverview: "Resumen",
    servicesDesc: "Gestiona tus servicios de masaje, precios y descripciones",
    promotionsDesc: "Añade etiquetas como \"Más popular\" u ofertas limitadas a servicios",
    contentDesc: "Edita textos del hero, CTAs, información de contacto y secciones",
    blogDesc: "Escribe y gestiona posts de blog optimizados para SEO con IA",
    faqDesc: "Actualiza las preguntas frecuentes que se muestran en el sitio",
    testimonialsDesc: "Gestiona testimonios y valoraciones de clientes",
    mediaDesc: "Sube y organiza imágenes para tu sitio",
    seoDesc: "Revisa el rendimiento de búsqueda, palabras clave y tips de SEO local",
  },
};

const ru: DashboardTranslations = {
  welcome: "С возвращением",
  siteOverview: "Обзор вашего сайта. Нажмите на любой раздел для управления.",
  manageYourSite: "Управление сайтом",
  tip: "💡 Совет",
  tipText: "Используйте раздел Блог для создания SEO-оптимизированных постов с помощью ИИ — он пишет в стиле вашего бренда и автоматически нацеливается на поисковые запросы Валенсии.",
  backToSite: "Вернуться на сайт",
  siteManager: "Менеджер сайта",
  sections: {
    overview: "Обзор",
    services: "Услуги",
    content: "Контент сайта",
    promotions: "Акции",
    blog: "Блог",
    seo: "SEO",
    media: "Медиа",
    faq: "Вопросы и ответы",
    testimonials: "Отзывы",
    history: "История",
  },
  overview: {
    monthlyViews: "Просмотров в месяц",
    googleRanking: "Позиция в Google",
    reviews: "Отзывы",
    languages: "Языки",
    servicesActive: "активных",
    promotionsActive: "активных",
    siteContentFields: "полей",
    blogPosts: "постов",
    blogDraft: "черновик",
    faqQuestions: "вопросов",
    testimonialsReviews: "отзывов",
    mediaFiles: "файлов",
    seoOverview: "Обзор",
    servicesDesc: "Управляйте услугами массажа, ценами и описаниями",
    promotionsDesc: "Добавляйте бейджи вроде «Самый популярный» или ограниченные предложения",
    contentDesc: "Редактируйте тексты hero, CTA, контакты и разделы",
    blogDesc: "Создавайте и управляйте SEO-оптимизированными постами с помощью ИИ",
    faqDesc: "Обновляйте часто задаваемые вопросы на сайте",
    testimonialsDesc: "Управляйте отзывами и оценками клиентов",
    mediaDesc: "Загружайте и организуйте изображения для сайта",
    seoDesc: "Проверяйте поисковую эффективность, ключевые слова и советы по локальному SEO",
  },
};

const translations: Record<Locale, DashboardTranslations> = { en, es, ru };

export const useDashboardT = (locale: Locale) => translations[locale];
