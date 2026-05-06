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
    carousels: string;
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
  promotions: {
    activeCount: string;
    addPromotion: string;
    editPromotion: string;
    newPromotion: string;
    updateDesc: string;
    addDesc: string;
    suggestWithAi: string;
    service: string;
    pickService: string;
    badgeEs: string;
    badgeEn: string;
    badgeRu: string;
    badgeColor: string;
    duration: string;
    preview: string;
    previewDesc: string;
    serviceNamePlaceholder: string;
    descriptionPlaceholder: string;
    extendsFromToday: string;
    activeForDays: string;
    cancel: string;
    saveChanges: string;
    createPromotion: string;
    active: string;
    activeDesc: string;
    expiredInactive: string;
    expiredDesc: string;
    noPromotions: string;
    noPromotionsHint: string;
    pause: string;
    resume: string;
    daysLeft: string;
    ended: string;
    days7: string;
    days10: string;
    weeks2: string;
    weeks3: string;
    month1: string;
    months2: string;
    months3: string;
    gold: string;
    rose: string;
    green: string;
    blue: string;
    purple: string;
    pickServiceError: string;
    promotionUpdated: string;
    promotionCreated: string;
    promotionRemoved: string;
    failedUpdate: string;
    failedSave: string;
    badgeIdeasReady: string;
    failedSuggestions: string;
    applied: string;
    suggested: string;
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
    carousels: "Carousels",
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
  promotions: {
    activeCount: "active promotion",
    addPromotion: "Add promotion",
    editPromotion: "Edit Promotion",
    newPromotion: "New Promotion",
    updateDesc: "Update badge text, color, or duration",
    addDesc: "Add a badge to a service",
    suggestWithAi: "Suggest badge ideas with AI",
    service: "Service",
    pickService: "Pick a service",
    badgeEs: "Badge (ES)",
    badgeEn: "Badge (EN)",
    badgeRu: "Badge (RU)",
    badgeColor: "Badge color",
    duration: "Duration",
    preview: "Preview",
    previewDesc: "how it looks on the site",
    serviceNamePlaceholder: "Service Name",
    descriptionPlaceholder: "Service description text will appear here…",
    extendsFromToday: "Extends {days} days from today",
    activeForDays: "Active for {days} days from today",
    cancel: "Cancel",
    saveChanges: "Save changes",
    createPromotion: "Create promotion",
    active: "Active",
    activeDesc: "Currently showing on the site",
    expiredInactive: "Expired / Inactive",
    expiredDesc: "Past or paused promotions",
    noPromotions: "No promotions yet",
    noPromotionsHint: "Add a badge like \"Most popular\" or \"10% off this week\" to highlight services",
    pause: "Pause",
    resume: "Resume",
    daysLeft: "{n} day{s} left · ends {date}",
    ended: "Ended {date}",
    days7: "7 days",
    days10: "10 days",
    weeks2: "2 weeks",
    weeks3: "3 weeks",
    month1: "1 month",
    months2: "2 months",
    months3: "3 months",
    gold: "Gold",
    rose: "Rose",
    green: "Green",
    blue: "Blue",
    purple: "Purple",
    pickServiceError: "Pick a service and enter badge text",
    promotionUpdated: "Promotion updated!",
    promotionCreated: "Promotion created!",
    promotionRemoved: "Promotion removed",
    failedUpdate: "Failed to update promotion",
    failedSave: "Failed to save promotion",
    badgeIdeasReady: "Badge ideas ready — pick one or write your own",
    failedSuggestions: "Failed to get suggestions",
    applied: "Applied — adjust and save",
    suggested: "Suggested: {days} days",
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
    carousels: "Carruseles",
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
  promotions: {
    activeCount: "promoción activa",
    addPromotion: "Añadir promoción",
    editPromotion: "Editar promoción",
    newPromotion: "Nueva promoción",
    updateDesc: "Actualiza texto, color o duración del badge",
    addDesc: "Añade un badge a un servicio",
    suggestWithAi: "Sugerir ideas con IA",
    service: "Servicio",
    pickService: "Elige un servicio",
    badgeEs: "Badge (ES)",
    badgeEn: "Badge (EN)",
    badgeRu: "Badge (RU)",
    badgeColor: "Color del badge",
    duration: "Duración",
    preview: "Vista previa",
    previewDesc: "cómo se ve en el sitio",
    serviceNamePlaceholder: "Nombre del servicio",
    descriptionPlaceholder: "El texto de descripción del servicio aparecerá aquí…",
    extendsFromToday: "Se extiende {days} días desde hoy",
    activeForDays: "Activa durante {days} días desde hoy",
    cancel: "Cancelar",
    saveChanges: "Guardar cambios",
    createPromotion: "Crear promoción",
    active: "Activas",
    activeDesc: "Mostrándose actualmente en el sitio",
    expiredInactive: "Expiradas / Inactivas",
    expiredDesc: "Promociones pasadas o pausadas",
    noPromotions: "Sin promociones aún",
    noPromotionsHint: "Añade un badge como \"Más popular\" o \"10% de descuento esta semana\" para destacar servicios",
    pause: "Pausar",
    resume: "Reanudar",
    daysLeft: "{n} día{s} restante{s} · termina {date}",
    ended: "Terminó {date}",
    days7: "7 días",
    days10: "10 días",
    weeks2: "2 semanas",
    weeks3: "3 semanas",
    month1: "1 mes",
    months2: "2 meses",
    months3: "3 meses",
    gold: "Oro",
    rose: "Rosa",
    green: "Verde",
    blue: "Azul",
    purple: "Morado",
    pickServiceError: "Elige un servicio e introduce el texto del badge",
    promotionUpdated: "¡Promoción actualizada!",
    promotionCreated: "¡Promoción creada!",
    promotionRemoved: "Promoción eliminada",
    failedUpdate: "Error al actualizar la promoción",
    failedSave: "Error al guardar la promoción",
    badgeIdeasReady: "Ideas de badges listas — elige una o escribe la tuya",
    failedSuggestions: "Error al obtener sugerencias",
    applied: "Aplicado — ajusta y guarda",
    suggested: "Sugerido: {days} días",
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
    carousels: "Карусели",
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
  promotions: {
    activeCount: "активная акция",
    addPromotion: "Добавить акцию",
    editPromotion: "Редактировать акцию",
    newPromotion: "Новая акция",
    updateDesc: "Обновите текст, цвет или длительность бейджа",
    addDesc: "Добавьте бейдж к услуге",
    suggestWithAi: "Предложить идеи с ИИ",
    service: "Услуга",
    pickService: "Выберите услугу",
    badgeEs: "Бейдж (ES)",
    badgeEn: "Бейдж (EN)",
    badgeRu: "Бейдж (RU)",
    badgeColor: "Цвет бейджа",
    duration: "Длительность",
    preview: "Предпросмотр",
    previewDesc: "как это выглядит на сайте",
    serviceNamePlaceholder: "Название услуги",
    descriptionPlaceholder: "Здесь будет текст описания услуги…",
    extendsFromToday: "Продлевается на {days} дней от сегодня",
    activeForDays: "Активна {days} дней от сегодня",
    cancel: "Отмена",
    saveChanges: "Сохранить изменения",
    createPromotion: "Создать акцию",
    active: "Активные",
    activeDesc: "Сейчас отображаются на сайте",
    expiredInactive: "Истёкшие / Неактивные",
    expiredDesc: "Прошлые или приостановленные акции",
    noPromotions: "Акций пока нет",
    noPromotionsHint: "Добавьте бейдж вроде «Самый популярный» или «Скидка 10% на этой неделе» для выделения услуг",
    pause: "Пауза",
    resume: "Возобновить",
    daysLeft: "Осталось {n} дн. · до {date}",
    ended: "Завершена {date}",
    days7: "7 дней",
    days10: "10 дней",
    weeks2: "2 недели",
    weeks3: "3 недели",
    month1: "1 месяц",
    months2: "2 месяца",
    months3: "3 месяца",
    gold: "Золото",
    rose: "Розовый",
    green: "Зелёный",
    blue: "Синий",
    purple: "Фиолетовый",
    pickServiceError: "Выберите услугу и введите текст бейджа",
    promotionUpdated: "Акция обновлена!",
    promotionCreated: "Акция создана!",
    promotionRemoved: "Акция удалена",
    failedUpdate: "Ошибка обновления акции",
    failedSave: "Ошибка сохранения акции",
    badgeIdeasReady: "Идеи бейджей готовы — выберите или напишите свой",
    failedSuggestions: "Не удалось получить предложения",
    applied: "Применено — настройте и сохраните",
    suggested: "Предложено: {days} дней",
  },
};

const translations: Record<Locale, DashboardTranslations> = { en, es, ru };

export const useDashboardT = (locale: Locale) => translations[locale];
