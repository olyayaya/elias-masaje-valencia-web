import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowDown, ArrowUp, Download, ExternalLink, Eye, EyeOff, Loader2, Pin, PinOff, Plus, RefreshCw,
  Star, Upload,
} from "lucide-react";
import { useI18n } from "@/i18n/context";
import {
  CSV_TEMPLATE, GOOGLE_PROFILE_URL, IMPORT_BATCH_SIZE, MAX_IMPORT_ROWS, REVIEW_SORTS, TRIPADVISOR_PROFILE_URL,
  checkImportFileSize, chunk, dedupeKey, httpsOnly, parseReviewImport, reviewSettingsTable, reviewsTable, sortReviews,
  type ImportIssue, type ImportPreview, type ParsedImportRow, type PreviewRow, type Review, type ReviewInsert,
  type ReviewSort,
} from "@/lib/reviews";
import { useAdminReviews, reviewKeys } from "@/hooks/use-reviews";
import DashboardCard from "./DashboardCard";
import DashboardTestimonials from "./DashboardTestimonials";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const COPY = {
  intro: {
    en: "Real reviews you add yourself: type them in, or import a CSV/JSON file you prepared. The site has no connection to Google, TripAdvisor or any other platform — nothing is fetched, copied or published automatically.",
    es: "Reseñas reales que añades tú: escríbelas a mano o importa un archivo CSV/JSON que hayas preparado. La web no tiene conexión con Google, TripAdvisor ni ninguna otra plataforma: no descarga, copia ni publica nada de forma automática.",
    ru: "Реальные отзывы, которые вы добавляете сами: вводите вручную или импортируйте подготовленный файл CSV/JSON. Сайт не подключён ни к Google, ни к TripAdvisor, ни к другим платформам — ничего не загружается, не копируется и не публикуется автоматически.",
  },
  missingTable: {
    en: "The reviews storage is not set up yet. Ask your developer to apply the pending reviews migration. The legacy editor below stays available until then.",
    es: "El almacenamiento de reseñas aún no está configurado. Pide que se aplique la migración pendiente. Mientras tanto sigue disponible el editor anterior.",
    ru: "Хранилище отзывов ещё не настроено. Попросите применить ожидающую миграцию. До этого доступен прежний редактор.",
  },
  legacyTitle: { en: "Legacy reviews", es: "Reseñas anteriores", ru: "Прежние отзывы" },
  search: { en: "Search author or text", es: "Buscar autor o texto", ru: "Поиск по автору или тексту" },
  ratingAll: { en: "All ratings", es: "Todas las valoraciones", ru: "Все оценки" },
  visibilityAll: { en: "Visible and hidden", es: "Visibles y ocultas", ru: "Видимые и скрытые" },
  visibilityVisible: { en: "Visible only", es: "Solo visibles", ru: "Только видимые" },
  visibilityHidden: { en: "Hidden only", es: "Solo ocultas", ru: "Только скрытые" },
  sortNewest: { en: "Newest first", es: "Más recientes", ru: "Сначала новые" },
  sortOldest: { en: "Oldest first", es: "Más antiguas", ru: "Сначала старые" },
  sortRatingHigh: { en: "Rating: high to low", es: "Valoración: alta a baja", ru: "Оценка: по убыванию" },
  sortRatingLow: { en: "Rating: low to high", es: "Valoración: baja a alta", ru: "Оценка: по возрастанию" },
  sortManual: { en: "Pinned / manual order", es: "Fijadas / orden manual", ru: "Закреплённые / вручную" },
  count: { en: "{n} reviews", es: "{n} reseñas", ru: "Отзывов: {n}" },
  empty: { en: "No reviews match these filters.", es: "Ninguna reseña coincide con los filtros.", ru: "Нет отзывов по этим фильтрам." },
  none: {
    en: "No reviews yet. Add one by hand or import a file below.",
    es: "Aún no hay reseñas. Añade una a mano o importa un archivo abajo.",
    ru: "Отзывов пока нет. Добавьте вручную или импортируйте файл ниже.",
  },
  openOriginal: { en: "Open original", es: "Abrir original", ru: "Открыть оригинал" },
  show: { en: "Show on site", es: "Mostrar en la web", ru: "Показывать на сайте" },
  hide: { en: "Hide from site", es: "Ocultar de la web", ru: "Скрыть с сайта" },
  pin: { en: "Pin to the top", es: "Fijar arriba", ru: "Закрепить сверху" },
  unpin: { en: "Unpin", es: "Desfijar", ru: "Открепить" },
  hiddenBadge: { en: "Hidden", es: "Oculta", ru: "Скрыта" },
  pinnedBadge: { en: "Pinned", es: "Fijada", ru: "Закреплена" },

  displayTitle: { en: "What the homepage shows", es: "Qué muestra la portada", ru: "Что показывает главная" },
  displayHint: {
    en: "These switches control the public site directly. 1–4★ stay off unless you turn them on.",
    es: "Estos interruptores controlan la web pública directamente. 1–4★ están apagados salvo que los actives.",
    ru: "Эти переключатели напрямую управляют публичным сайтом. 1–4★ выключены, пока вы их не включите.",
  },
  sectionEnabled: { en: "Show the reviews section", es: "Mostrar la sección de reseñas", ru: "Показывать раздел отзывов" },
  starsToggle: { en: "{n}★ reviews", es: "Reseñas de {n}★", ru: "Отзывы на {n}★" },
  settingsSaved: { en: "Display settings saved", es: "Ajustes guardados", ru: "Настройки сохранены" },
  publicSort: { en: "Order on the homepage", es: "Orden en la portada", ru: "Порядок на главной" },
  publicSortHint: {
    en: "Saved and used by the public site. Pinned reviews always come first.",
    es: "Se guarda y lo usa la web pública. Las reseñas fijadas siempre van primero.",
    ru: "Сохраняется и применяется на публичном сайте. Закреплённые всегда первыми.",
  },
  listSort: { en: "Order in this list only", es: "Orden solo en esta lista", ru: "Порядок только в этом списке" },
  priority: { en: "Manual order value", es: "Valor de orden manual", ru: "Значение ручного порядка" },
  priorityUp: { en: "Move up in manual order", es: "Subir en el orden manual", ru: "Поднять в ручном порядке" },
  priorityDown: { en: "Move down in manual order", es: "Bajar en el orden manual", ru: "Опустить в ручном порядке" },

  profilesTitle: { en: "Where your reviews live", es: "Dónde están tus reseñas", ru: "Где находятся ваши отзывы" },
  profilesBody: {
    en: "These are plain links to your public profiles. Their content is never downloaded, copied or shown here — to publish a review on this site you add it yourself and confirm you have the right to do so.",
    es: "Son simples enlaces a tus perfiles públicos. Su contenido no se descarga, copia ni se muestra aquí: para publicar una reseña en esta web la añades tú y confirmas que tienes derecho a hacerlo.",
    ru: "Это обычные ссылки на ваши публичные профили. Их содержимое не загружается, не копируется и не показывается здесь: чтобы опубликовать отзыв на сайте, вы добавляете его сами и подтверждаете право на публикацию.",
  },
  openGoogle: { en: "Open Google profile", es: "Abrir perfil de Google", ru: "Открыть профиль Google" },
  openTripadvisor: { en: "Open TripAdvisor profile", es: "Abrir perfil de TripAdvisor", ru: "Открыть профиль TripAdvisor" },

  manualTitle: { en: "Add a review by hand", es: "Añadir una reseña a mano", ru: "Добавить отзыв вручную" },
  manualHint: {
    en: "Type the review exactly as the customer wrote it. It is saved hidden — review it in the list below and switch it on when you are ready.",
    es: "Escribe la reseña tal como la escribió el cliente. Se guarda oculta: revísala en la lista de abajo y actívala cuando quieras.",
    ru: "Введите отзыв дословно, как написал клиент. Он сохраняется скрытым — проверьте его в списке ниже и включите, когда будете готовы.",
  },
  fAuthor: { en: "Customer name", es: "Nombre del cliente", ru: "Имя клиента" },
  fRating: { en: "Rating", es: "Valoración", ru: "Оценка" },
  fText: { en: "Review text", es: "Texto de la reseña", ru: "Текст отзыва" },
  fDate: { en: "Date", es: "Fecha", ru: "Дата" },
  fUrl: { en: "Link to the original (optional, https)", es: "Enlace al original (opcional, https)", ru: "Ссылка на оригинал (необязательно, https)" },
  manualAdd: { en: "Add review", es: "Añadir reseña", ru: "Добавить отзыв" },
  manualAdded: { en: "Review added (hidden)", es: "Reseña añadida (oculta)", ru: "Отзыв добавлен (скрыт)" },
  manualIncomplete: { en: "Name, rating and text are required.", es: "El nombre, la valoración y el texto son obligatorios.", ru: "Имя, оценка и текст обязательны." },
  manualDuplicate: { en: "This review is already saved.", es: "Esta reseña ya está guardada.", ru: "Этот отзыв уже сохранён." },

  importTitle: { en: "Import reviews (CSV or JSON)", es: "Importar reseñas (CSV o JSON)", ru: "Импорт отзывов (CSV или JSON)" },
  importHint: {
    en: "Columns: author_name, rating, review_text, reviewed_at, original_url. Up to {rows} rows and {mb} MB per file. Nothing is saved until you pick the rows, tick the rights box and confirm.",
    es: "Columnas: author_name, rating, review_text, reviewed_at, original_url. Máximo {rows} filas y {mb} MB por archivo. No se guarda nada hasta que elijas las filas, marques la casilla de derechos y confirmes.",
    ru: "Столбцы: author_name, rating, review_text, reviewed_at, original_url. Не более {rows} строк и {mb} МБ на файл. Ничего не сохраняется, пока вы не выберете строки, не отметите подтверждение прав и не подтвердите импорт.",
  },
  template: { en: "Download CSV template", es: "Descargar plantilla CSV", ru: "Скачать шаблон CSV" },
  choose: { en: "Choose file", es: "Elegir archivo", ru: "Выбрать файл" },
  summary: {
    en: "{total} rows · {valid} importable · {dupFile} duplicated in the file · {dupDb} already saved · {invalid} with errors",
    es: "{total} filas · {valid} importables · {dupFile} duplicadas en el archivo · {dupDb} ya guardadas · {invalid} con errores",
    ru: "Строк: {total} · к импорту: {valid} · дубликатов в файле: {dupFile} · уже сохранено: {dupDb} · с ошибками: {invalid}",
  },
  selected: { en: "{n} selected", es: "{n} seleccionadas", ru: "Выбрано: {n}" },
  selectAll: { en: "Select all importable", es: "Seleccionar todas las importables", ru: "Выбрать все доступные" },
  clearSel: { en: "Clear selection", es: "Quitar selección", ru: "Снять выбор" },
  selectHint: {
    en: "Click a row to select it. Shift+click selects a range, Ctrl/⌘+click adds one row.",
    es: "Haz clic en una fila para seleccionarla. Mayús+clic selecciona un rango, Ctrl/⌘+clic añade una fila.",
    ru: "Нажмите на строку, чтобы выбрать её. Shift+клик — диапазон, Ctrl/⌘+клик — одна строка.",
  },
  importRights: {
    en: "I confirm these are real customer reviews and that I have the right to publish this text on my site.",
    es: "Confirmo que son reseñas reales de clientes y que tengo derecho a publicar este texto en mi web.",
    ru: "Подтверждаю, что это реальные отзывы клиентов и что у меня есть право публиковать этот текст на моём сайте.",
  },
  importRightsHint: {
    en: "Reviews are stored exactly as written — never edited, translated or invented.",
    es: "Las reseñas se guardan tal cual — nunca se editan, traducen ni inventan.",
    ru: "Отзывы сохраняются дословно — их не редактируют, не переводят и не выдумывают.",
  },
  visibilityChoice: { en: "After importing", es: "Después de importar", ru: "После импорта" },
  visHidden: {
    en: "Import hidden — review them and switch them on later (recommended)",
    es: "Importar ocultas — revísalas y actívalas después (recomendado)",
    ru: "Импортировать скрытыми — проверить и включить позже (рекомендуется)",
  },
  visPublish: {
    en: "Publish the selected reviews immediately",
    es: "Publicar las reseñas seleccionadas inmediatamente",
    ru: "Опубликовать выбранные сразу",
  },
  visHiddenNote: {
    en: "Nothing will appear on the homepage until you switch each review on.",
    es: "No aparecerá nada en la portada hasta que actives cada reseña.",
    ru: "На главной ничего не появится, пока вы не включите каждый отзыв.",
  },
  visPublishNote: {
    en: "The selected reviews go live on the homepage right away.",
    es: "Las reseñas seleccionadas se publican en la portada de inmediato.",
    ru: "Выбранные отзывы сразу появятся на главной.",
  },
  visIgnoresFile: {
    en: "A visible/published column inside the file is ignored — only this choice decides.",
    es: "Cualquier columna «visible/publicada» del archivo se ignora: solo decide esta opción.",
    ru: "Колонка «visible/published» в файле игнорируется — решает только этот выбор.",
  },
  importNeedsRights: { en: "Tick the confirmation above to enable the import.", es: "Marca la confirmación de arriba para poder importar.", ru: "Отметьте подтверждение выше, чтобы включить импорт." },
  importConfirm: { en: "Import {n}", es: "Importar {n}", ru: "Импортировать {n}" },
  importCancel: { en: "Discard", es: "Descartar", ru: "Отменить" },
  importing: { en: "Importing {done}/{total}…", es: "Importando {done}/{total}…", ru: "Импорт {done}/{total}…" },
  importDone: { en: "Imported {n} reviews", es: "{n} reseñas importadas", ru: "Импортировано отзывов: {n}" },
  importFailed: { en: "Import failed", es: "Error al importar", ru: "Ошибка импорта" },
  report: {
    en: "Added {added} · skipped as duplicates {skipped} · not imported {failed}",
    es: "Añadidas {added} · omitidas por duplicado {skipped} · sin importar {failed}",
    ru: "Добавлено: {added} · пропущено дубликатов: {skipped} · не импортировано: {failed}",
  },
  retryFailed: { en: "Retry the rows that failed", es: "Reintentar las filas fallidas", ru: "Повторить неудавшиеся строки" },
  colSel: { en: "Select", es: "Seleccionar", ru: "Выбрать" },
  colLine: { en: "Row", es: "Fila", ru: "Строка" },
  colAuthor: { en: "Author", es: "Autor", ru: "Автор" },
  colRating: { en: "Rating", es: "Valoración", ru: "Оценка" },
  colDate: { en: "Date", es: "Fecha", ru: "Дата" },
  colText: { en: "Review", es: "Reseña", ru: "Отзыв" },
  colState: { en: "Status", es: "Estado", ru: "Статус" },
  stNew: { en: "Ready", es: "Lista", ru: "Готова" },
  stDupFile: { en: "Duplicate in file", es: "Duplicada en el archivo", ru: "Дубликат в файле" },
  stDupDb: { en: "Already saved", es: "Ya guardada", ru: "Уже сохранена" },
  stInvalid: { en: "Error", es: "Error", ru: "Ошибка" },
  lastImport: { en: "Last import: {v}", es: "Última importación: {v}", ru: "Последний импорт: {v}" },
  neverImported: { en: "never", es: "nunca", ru: "никогда" },
  saveFailed: { en: "Failed to save", es: "Error al guardar", ru: "Не удалось сохранить" },
  manualUrlInvalid: {
    en: "The link must be a full https:// address, or left empty.",
    es: "El enlace debe ser una dirección https:// completa, o quedar vacío.",
    ru: "Ссылка должна быть полным адресом https:// или пустой.",
  },

  /* row / file problems */
  file_too_large: { en: "The file is larger than {max} MB.", es: "El archivo supera {max} MB.", ru: "Файл больше {max} МБ." },
  file_empty: { en: "The file is empty.", es: "El archivo está vacío.", ru: "Файл пуст." },
  invalid_json: { en: "The file is not valid JSON.", es: "El archivo no es un JSON válido.", ru: "Файл не является корректным JSON." },
  json_not_array: { en: "Expected a JSON list of reviews.", es: "Se esperaba una lista JSON de reseñas.", ru: "Ожидался JSON-список отзывов." },
  csv_no_rows: { en: "The CSV needs a header row and at least one review.", es: "El CSV necesita una fila de cabecera y al menos una reseña.", ru: "В CSV нужна строка заголовка и хотя бы один отзыв." },
  too_many_rows: { en: "Too many rows ({count}). The limit is {max}.", es: "Demasiadas filas ({count}). El límite es {max}.", ru: "Слишком много строк ({count}). Лимит — {max}." },
  author_required: { en: "The customer name is missing.", es: "Falta el nombre del cliente.", ru: "Отсутствует имя клиента." },
  author_too_long: { en: "The name is longer than {max} characters.", es: "El nombre supera {max} caracteres.", ru: "Имя длиннее {max} символов." },
  rating_invalid: { en: "The rating must be a whole number from 1 to 5 (found: {value}).", es: "La valoración debe ser un número entero de 1 a 5 (encontrado: {value}).", ru: "Оценка должна быть целым числом от 1 до 5 (найдено: {value})." },
  text_required: { en: "The review text is missing.", es: "Falta el texto de la reseña.", ru: "Отсутствует текст отзыва." },
  text_too_long: { en: "The text is longer than {max} characters.", es: "El texto supera {max} caracteres.", ru: "Текст длиннее {max} символов." },
  date_invalid: { en: "The date is not valid ({value}).", es: "La fecha no es válida ({value}).", ru: "Некорректная дата ({value})." },
  url_invalid: { en: "The link must start with https://", es: "El enlace debe empezar por https://", ru: "Ссылка должна начинаться с https://" },
} as const;

type UiLang = "en" | "es" | "ru";
const fill = (s: string, vars: Record<string, string>) =>
  Object.entries(vars).reduce((a, [k, v]) => a.split(`{${k}}`).join(v), s);

const useCopy = () => {
  const { locale } = useI18n();
  const ui: UiLang = (["en", "es", "ru"] as const).includes(locale as UiLang) ? (locale as UiLang) : "en";
  return (k: keyof typeof COPY, vars: Record<string, string> = {}) => fill(COPY[k][ui], vars);
};

const SORT_LABEL: Record<ReviewSort, keyof typeof COPY> = {
  newest: "sortNewest",
  oldest: "sortOldest",
  rating_high: "sortRatingHigh",
  rating_low: "sortRatingLow",
  manual: "sortManual",
};

const STATUS_LABEL: Record<PreviewRow["status"], keyof typeof COPY> = {
  new: "stNew",
  duplicate_file: "stDupFile",
  duplicate_existing: "stDupDb",
  invalid: "stInvalid",
};

const Stars = ({ n }: { n: number }) => (
  <span className="flex gap-0.5" aria-label={`${n}/5`}>
    {Array.from({ length: 5 }).map((_, i) => (
      <Star key={i} size={12} className={i < n ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"} />
    ))}
  </span>
);

interface ImportReport {
  added: number;
  skipped: number;
  failed: ParsedImportRow[];
}

const DashboardReviews = () => {
  const c = useCopy();
  const qc = useQueryClient();
  const { items, settings, missingTable, isPending } = useAdminReviews();

  const [search, setSearch] = useState("");
  const [rating, setRating] = useState<"all" | number>("all");
  const [visibility, setVisibility] = useState<"all" | "visible" | "hidden">("all");
  const [sort, setSort] = useState<ReviewSort>("newest");
  const [busyId, setBusyId] = useState<string | null>(null);

  // manual entry
  const [form, setForm] = useState({ author_name: "", rating: "5", review_text: "", reviewed_at: "", original_url: "" });
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const addingRef = useRef(false);

  // import
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [anchor, setAnchor] = useState<number | null>(null);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  /** Publication is decided here and nowhere else — never by the file. */
  const [publishNow, setPublishNow] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const importing = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: reviewKeys.adminList });
    void qc.invalidateQueries({ queryKey: reviewKeys.publicList });
    void qc.invalidateQueries({ queryKey: reviewKeys.settings });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = items.filter((r) => {
      if (rating !== "all" && r.rating !== rating) return false;
      if (visibility === "visible" && !r.visible) return false;
      if (visibility === "hidden" && r.visible) return false;
      if (q && !`${r.author_name} ${r.review_text}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return sortReviews(list, sort);
  }, [items, search, rating, visibility, sort]);

  const patch = async (id: string, values: Record<string, unknown>) => {
    setBusyId(id);
    const { error } = await reviewsTable().update(values).eq("id", id);
    setBusyId(null);
    if (error) {
      toast.error(c("saveFailed"));
      return;
    }
    refresh();
  };

  const saveSettings = async (values: Record<string, unknown>) => {
    const query = reviewSettingsTable().update(values);
    const { error } = settings.id ? await query.eq("id", settings.id) : await query.neq("id", "");
    if (error) {
      toast.error(c("saveFailed"));
      return;
    }
    toast.success(c("settingsSaved"));
    refresh();
  };

  const toggleRatingBand = (n: number) => {
    const cur = settings.allowed_ratings ?? [];
    const next = cur.includes(n) ? cur.filter((r) => r !== n) : [...cur, n].sort((a, b) => a - b);
    void saveSettings({ allowed_ratings: next });
  };

  /** Manual order nudge: ±1 keeps the numbers readable for a non-technical owner. */
  const bumpPriority = (r: Review, delta: number) =>
    void patch(r.id, { manual_priority: Math.max(-999, Math.min(999, r.manual_priority + delta)) });

  /* ------------------------------------------------------ manual entry --- */

  const addManual = async () => {
    if (addingRef.current) return;
    const author = form.author_name.trim();
    const text = form.review_text.trim();
    const stars = Number(form.rating);
    if (!author || !text || !Number.isInteger(stars) || stars < 1 || stars > 5) {
      setFormError(c("manualIncomplete"));
      toast.error(c("manualIncomplete"));
      return;
    }
    // A mistyped link is reported, never silently discarded.
    const link = httpsOnly(form.original_url.trim());
    if (link.bad) {
      setFormError(c("manualUrlInvalid"));
      toast.error(c("manualUrlInvalid"));
      return;
    }
    const reviewedAt = form.reviewed_at ? new Date(form.reviewed_at).toISOString() : null;
    const key = dedupeKey({ author_name: author, review_text: text, reviewed_at: reviewedAt });
    if (items.some((r) => r.dedupe_key === key)) {
      setFormError(c("manualDuplicate"));
      toast.error(c("manualDuplicate"));
      return;
    }
    setFormError(null);
    addingRef.current = true;
    setAdding(true);
    const { error } = await reviewsTable().insert([
      {
        dedupe_key: key,
        author_name: author,
        rating: stars,
        review_text: text,
        reviewed_at: reviewedAt,
        original_url: link.url,
        // Added hidden: the owner decides when it appears on the homepage.
        visible: false,
        imported_at: new Date().toISOString(),
      },
    ]);
    addingRef.current = false;
    setAdding(false);
    if (error) {
      toast.error(c("saveFailed"));
      return;
    }
    toast.success(c("manualAdded"));
    setForm({ author_name: "", rating: "5", review_text: "", reviewed_at: "", original_url: "" });
    refresh();
  };

  /* ----------------------------------------------------------- import --- */

  const knownKeys = useMemo(() => items.map((r) => r.dedupe_key), [items]);

  const resetImport = () => {
    setPreview(null);
    setSelected(new Set());
    setAnchor(null);
    setRightsConfirmed(false);
    setProgress(null);
    setReport(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setReport(null);
    const tooBig = checkImportFileSize(file.size);
    if (tooBig) {
      setPreview({ rows: [], fileIssues: [tooBig], counts: { total: 0, valid: 0, duplicateFile: 0, duplicateExisting: 0, invalid: 0 } });
      setSelected(new Set());
      setRightsConfirmed(false);
      return;
    }
    const result = parseReviewImport(await file.text(), knownKeys);
    setPreview(result);
    // Importable rows start selected; everything else can never be selected.
    setSelected(new Set(result.rows.filter((r) => r.status === "new").map((r) => r.line)));
    setAnchor(null);
    // Every new file needs its own explicit rights confirmation.
    setRightsConfirmed(false);
  };

  const rows = preview?.rows ?? [];
  const importable = useMemo(() => rows.filter((r) => r.status === "new"), [rows]);

  const toggleRow = (row: PreviewRow, e: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }) => {
    if (row.status !== "new") return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (e.shiftKey && anchor !== null) {
        const [lo, hi] = anchor < row.line ? [anchor, row.line] : [row.line, anchor];
        importable.filter((r) => r.line >= lo && r.line <= hi).forEach((r) => next.add(r.line));
        return next;
      }
      if (next.has(row.line)) next.delete(row.line);
      else next.add(row.line);
      return next;
    });
    if (!e.shiftKey) setAnchor(row.line);
  };

  const selectedRows = useMemo(
    () => importable.filter((r) => selected.has(r.line)).map((r) => r.row as ParsedImportRow),
    [importable, selected],
  );

  /** Insert in batches so one bad batch never loses the rest of the file. */
  const runImport = async (list: ParsedImportRow[]) => {
    if (!list.length || !rightsConfirmed || importing.current) return;
    importing.current = true;
    setReport(null);
    const stamp = new Date().toISOString();
    const batches = chunk(list, IMPORT_BATCH_SIZE);
    let added = 0;
    const failed: ParsedImportRow[] = [];
    setProgress({ done: 0, total: list.length });
    for (const batch of batches) {
      const payload: ReviewInsert[] = batch.map((r) => ({ ...r, imported_at: stamp }));
      // ON CONFLICT DO NOTHING on dedupe_key: a re-import can never duplicate a
      // review and never overwrites the owner's visible / pinned decisions.
      const { error } = await reviewsTable().upsert(payload, { onConflict: "dedupe_key", ignoreDuplicates: true });
      if (error) failed.push(...batch);
      else added += batch.length;
      setProgress((p) => ({ done: (p?.done ?? 0) + batch.length, total: list.length }));
    }
    importing.current = false;
    setProgress(null);
    const skipped = (preview?.counts.duplicateExisting ?? 0) + (preview?.counts.duplicateFile ?? 0);
    setReport({ added, skipped, failed });
    if (failed.length) toast.error(c("importFailed"));
    else toast.success(c("importDone", { n: String(added) }));
    if (added) {
      refresh();
      setSelected(new Set(failed.map((r) => rows.find((p) => p.row?.dedupe_key === r.dedupe_key)?.line ?? -1)));
    }
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "reviews-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const issueText = (i: ImportIssue) => c(i.code, i.vars ?? {});

  const lastImport = useMemo(() => {
    const stamps = items.map((r) => r.imported_at).filter(Boolean) as string[];
    return stamps.length ? (stamps.sort().at(-1) ?? null) : null;
  }, [items]);

  const selectClass =
    "px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{c("intro")}</p>

      {missingTable && (
        <DashboardCard>
          <p className="text-sm text-muted-foreground flex items-start gap-2" data-testid="reviews-missing-table">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            {c("missingTable")}
          </p>
        </DashboardCard>
      )}

      {/* ---------------------------------------------- display settings --- */}
      <DashboardCard title={c("displayTitle")}>
        <p className="text-xs text-muted-foreground mb-3">{c("displayHint")}</p>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.section_enabled}
              disabled={missingTable}
              onChange={(e) => void saveSettings({ section_enabled: e.target.checked })}
            />
            {c("sectionEnabled")}
          </label>
          <div className="flex flex-wrap gap-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={(settings.allowed_ratings ?? []).includes(n)}
                  disabled={missingTable}
                  onChange={() => toggleRatingBand(n)}
                  aria-label={c("starsToggle", { n: String(n) })}
                />
                {c("starsToggle", { n: String(n) })}
              </label>
            ))}
          </div>
          <div className="pt-2">
            <label className="block text-xs text-muted-foreground mb-1" htmlFor="public-sort">
              {c("publicSort")}
            </label>
            <select
              id="public-sort"
              className={selectClass}
              value={settings.sort_mode}
              disabled={missingTable}
              aria-label={c("publicSort")}
              onChange={(e) => void saveSettings({ sort_mode: e.target.value as ReviewSort })}
            >
              {REVIEW_SORTS.map((m) => (
                <option key={m} value={m}>{c(SORT_LABEL[m])}</option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">{c("publicSortHint")}</p>
          </div>
        </div>
      </DashboardCard>

      {/* ------------------------------------------------ profile links --- */}
      {/* Links only: no API, no keys, no import from these platforms. */}
      <DashboardCard title={c("profilesTitle")}>
        <p className="text-xs text-muted-foreground mb-3" data-testid="reviews-profiles-note">
          {c("profilesBody")}
        </p>
        <div className="flex flex-wrap gap-4">
          <a
            href={GOOGLE_PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-foreground underline underline-offset-2 hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded"
          >
            <ExternalLink size={13} /> {c("openGoogle")}
          </a>
          <a
            href={TRIPADVISOR_PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-foreground underline underline-offset-2 hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded"
          >
            <ExternalLink size={13} /> {c("openTripadvisor")}
          </a>
        </div>
      </DashboardCard>

      {/* ---------------------------------------------------- manual add --- */}
      <DashboardCard title={c("manualTitle")}>
        <p className="text-xs text-muted-foreground mb-3">{c("manualHint")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-muted-foreground">
            {c("fAuthor")}
            <Input
              value={form.author_name}
              maxLength={120}
              onChange={(e) => setForm((f) => ({ ...f, author_name: e.target.value }))}
              className="mt-1"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            {c("fRating")}
            <select
              className={`${selectClass} mt-1 block w-full`}
              value={form.rating}
              onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))}
              aria-label={c("fRating")}
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>{n}★</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground sm:col-span-2">
            {c("fText")}
            <textarea
              value={form.review_text}
              maxLength={5000}
              rows={3}
              onChange={(e) => setForm((f) => ({ ...f, review_text: e.target.value }))}
              className="mt-1 w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            {c("fDate")}
            <Input
              type="date"
              value={form.reviewed_at}
              onChange={(e) => setForm((f) => ({ ...f, reviewed_at: e.target.value }))}
              className="mt-1"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            {c("fUrl")}
            <Input
              type="url"
              inputMode="url"
              value={form.original_url}
              onChange={(e) => setForm((f) => ({ ...f, original_url: e.target.value }))}
              className="mt-1"
            />
          </label>
        </div>
        <Button size="sm" className="mt-3 min-h-11" disabled={adding || missingTable} onClick={() => void addManual()}>
          {adding ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Plus size={13} className="mr-1.5" />}
          {c("manualAdd")}
        </Button>
      </DashboardCard>

      {/* --------------------------------------------------------- import --- */}
      <DashboardCard title={c("importTitle")}>
        <p className="text-xs text-muted-foreground mb-3">
          {c("importHint", { rows: String(MAX_IMPORT_ROWS), mb: "2" })}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json,text/csv,application/json"
            aria-label={c("choose")}
            onChange={(e) => void onFile(e.target.files?.[0])}
            className="text-sm"
          />
          <Button size="sm" variant="outline" className="min-h-11" onClick={downloadTemplate}>
            <Download size={13} className="mr-1.5" /> {c("template")}
          </Button>
        </div>

        {preview && preview.fileIssues.length > 0 && (
          <ul className="mt-3 text-xs text-destructive space-y-1" role="alert" data-testid="import-file-errors">
            {preview.fileIssues.map((i) => (
              <li key={i.code}>{issueText(i)}</li>
            ))}
          </ul>
        )}

        {preview && rows.length > 0 && (
          <div className="mt-3 space-y-3" data-testid="import-preview">
            <p className="text-xs text-muted-foreground" data-testid="import-summary">
              {c("summary", {
                total: String(preview.counts.total),
                valid: String(preview.counts.valid),
                dupFile: String(preview.counts.duplicateFile),
                dupDb: String(preview.counts.duplicateExisting),
                invalid: String(preview.counts.invalid),
              })}
            </p>
            <p className="text-xs text-muted-foreground">{c("selectHint")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="min-h-11"
                onClick={() => setSelected(new Set(importable.map((r) => r.line)))}
              >
                {c("selectAll")}
              </Button>
              <Button size="sm" variant="ghost" className="min-h-11" onClick={() => setSelected(new Set())}>
                {c("clearSel")}
              </Button>
              <span className="text-xs text-muted-foreground" aria-live="polite" data-testid="import-selected">
                {c("selected", { n: String(selected.size) })}
              </span>
            </div>

            <div className="max-h-80 overflow-auto border border-border rounded-lg">
              <table className="w-full text-xs" data-testid="import-table">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr className="text-left">
                    <th className="p-2 font-medium">{c("colSel")}</th>
                    <th className="p-2 font-medium">{c("colLine")}</th>
                    <th className="p-2 font-medium">{c("colAuthor")}</th>
                    <th className="p-2 font-medium">{c("colRating")}</th>
                    <th className="p-2 font-medium">{c("colDate")}</th>
                    <th className="p-2 font-medium">{c("colText")}</th>
                    <th className="p-2 font-medium">{c("colState")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const selectable = r.status === "new";
                    const isSelected = selectable && selected.has(r.line);
                    return (
                      <tr
                        key={r.line}
                        data-testid={`import-row-${r.line}`}
                        aria-selected={selectable ? isSelected : undefined}
                        tabIndex={selectable ? 0 : -1}
                        onClick={(e) => toggleRow(r, e)}
                        onKeyDown={(e) => {
                          if (e.key === " " || e.key === "Enter") {
                            e.preventDefault();
                            toggleRow(r, e);
                          }
                        }}
                        className={`border-t border-border align-top cursor-default ${
                          isSelected ? "bg-primary/10" : ""
                        } ${r.status === "invalid" ? "opacity-70" : ""}`}
                      >
                        <td className="p-2">
                          <input
                            type="checkbox"
                            className="w-5 h-5"
                            checked={isSelected}
                            disabled={!selectable}
                            aria-label={`${c("colSel")} ${r.line}`}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => toggleRow(r, e.nativeEvent as unknown as { shiftKey?: boolean })}
                          />
                        </td>
                        <td className="p-2 tabular-nums text-muted-foreground min-h-11">{r.line}</td>
                        <td className="p-2 whitespace-nowrap">{r.raw.author_name || "—"}</td>
                        <td className="p-2">{r.row ? <Stars n={r.row.rating} /> : r.raw.rating || "—"}</td>
                        <td className="p-2 whitespace-nowrap text-muted-foreground">
                          {r.row?.reviewed_at ? new Date(r.row.reviewed_at).toLocaleDateString() : r.raw.reviewed_at || "—"}
                        </td>
                        <td className="p-2 text-muted-foreground max-w-md">{r.raw.review_text}</td>
                        <td className="p-2 whitespace-nowrap">
                          <span className={r.status === "invalid" ? "text-destructive" : "text-muted-foreground"}>
                            {c(STATUS_LABEL[r.status])}
                          </span>
                          {r.issues.length > 0 && (
                            <ul className="mt-1 text-[11px] text-destructive space-y-0.5">
                              {r.issues.map((i) => (
                                <li key={i.code}>{issueText(i)}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <label className="flex items-start gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                className="mt-0.5 w-5 h-5"
                checked={rightsConfirmed}
                onChange={(e) => setRightsConfirmed(e.target.checked)}
                data-testid="import-rights"
              />
              <span>
                {c("importRights")}
                <span className="block text-muted-foreground">{c("importRightsHint")}</span>
              </span>
            </label>

            <div className="flex gap-2 items-center flex-wrap">
              <Button
                size="sm"
                className="min-h-11"
                disabled={!!progress || missingTable || !rightsConfirmed || selectedRows.length === 0}
                onClick={() => void runImport(selectedRows)}
              >
                {progress ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Upload size={13} className="mr-1.5" />}
                {progress
                  ? c("importing", { done: String(progress.done), total: String(progress.total) })
                  : c("importConfirm", { n: String(selectedRows.length) })}
              </Button>
              <Button size="sm" variant="ghost" className="min-h-11" onClick={resetImport}>
                {c("importCancel")}
              </Button>
              {!rightsConfirmed && <span className="text-[11px] text-muted-foreground">{c("importNeedsRights")}</span>}
            </div>
          </div>
        )}

        {report && (
          <div className="mt-3 space-y-2" role="status" aria-live="polite" data-testid="import-report">
            <p className="text-xs text-muted-foreground">
              {c("report", {
                added: String(report.added),
                skipped: String(report.skipped),
                failed: String(report.failed.length),
              })}
            </p>
            {report.failed.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="min-h-11"
                disabled={!!progress}
                onClick={() => void runImport(report.failed)}
              >
                <RefreshCw size={13} className="mr-1.5" /> {c("retryFailed")}
              </Button>
            )}
          </div>
        )}

        <p className="mt-3 text-[11px] text-muted-foreground">
          {c("lastImport", { v: lastImport ? new Date(lastImport).toLocaleString() : c("neverImported") })}
        </p>
      </DashboardCard>

      {/* -------------------------------------------------------- filters --- */}
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={c("search")}
          aria-label={c("search")}
          className="max-w-xs"
        />
        <select
          className={selectClass}
          value={String(rating)}
          aria-label={c("ratingAll")}
          onChange={(e) => setRating(e.target.value === "all" ? "all" : Number(e.target.value))}
        >
          <option value="all">{c("ratingAll")}</option>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>{n}★</option>
          ))}
        </select>
        <select
          className={selectClass}
          value={visibility}
          aria-label={c("visibilityAll")}
          onChange={(e) => setVisibility(e.target.value as "all" | "visible" | "hidden")}
        >
          <option value="all">{c("visibilityAll")}</option>
          <option value="visible">{c("visibilityVisible")}</option>
          <option value="hidden">{c("visibilityHidden")}</option>
        </select>
        <select
          className={selectClass}
          value={sort}
          aria-label={c("listSort")}
          onChange={(e) => setSort(e.target.value as ReviewSort)}
        >
          <option value="newest">{c("sortNewest")}</option>
          <option value="oldest">{c("sortOldest")}</option>
          <option value="rating_high">{c("sortRatingHigh")}</option>
          <option value="rating_low">{c("sortRatingLow")}</option>
          <option value="manual">{c("sortManual")}</option>
        </select>
        <span className="text-xs text-muted-foreground ml-auto">{c("count", { n: String(filtered.length) })}</span>
      </div>

      {/* ---------------------------------------------------------- list --- */}
      {isPending ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-muted-foreground" size={20} />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6">{missingTable ? c("missingTable") : c("none")}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6">{c("empty")}</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((r: Review) => (
            <DashboardCard key={r.id}>
              <div className={`flex items-start justify-between gap-4 ${r.visible ? "" : "opacity-50"}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h4 className="text-sm font-medium text-foreground">{r.author_name}</h4>
                    {!r.visible && (
                      <span className="text-[10px] px-2 py-0.5 bg-secondary text-muted-foreground rounded-full">{c("hiddenBadge")}</span>
                    )}
                    {r.pinned && (
                      <span className="text-[10px] px-2 py-0.5 bg-secondary text-muted-foreground rounded-full">{c("pinnedBadge")}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Stars n={r.rating} />
                    {r.reviewed_at && (
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(r.reviewed_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-pre-line">{r.review_text}</p>
                  {r.original_url && (
                    <a
                      href={r.original_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink size={11} /> {c("openOriginal")}
                    </a>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => void patch(r.id, { visible: !r.visible })}
                    disabled={busyId === r.id}
                    title={r.visible ? c("hide") : c("show")}
                    aria-label={r.visible ? c("hide") : c("show")}
                    className="p-2 min-w-11 min-h-11 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary"
                  >
                    {r.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button
                    onClick={() => void patch(r.id, { pinned: !r.pinned })}
                    disabled={busyId === r.id}
                    title={r.pinned ? c("unpin") : c("pin")}
                    aria-label={r.pinned ? c("unpin") : c("pin")}
                    className="p-2 min-w-11 min-h-11 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary"
                  >
                    {r.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                  </button>
                  <div className="flex flex-col">
                    <button
                      onClick={() => bumpPriority(r, 1)}
                      disabled={busyId === r.id}
                      title={c("priorityUp")}
                      aria-label={c("priorityUp")}
                      className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-secondary"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      onClick={() => bumpPriority(r, -1)}
                      disabled={busyId === r.id}
                      title={c("priorityDown")}
                      aria-label={c("priorityDown")}
                      className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-secondary"
                    >
                      <ArrowDown size={12} />
                    </button>
                  </div>
                  <span
                    className="self-center text-[11px] text-muted-foreground tabular-nums"
                    title={c("priority")}
                    data-testid={`priority-${r.id}`}
                  >
                    {r.manual_priority}
                  </span>
                </div>
              </div>
            </DashboardCard>
          ))}
        </div>
      )}

      {/* The previous editor stays reachable until the migration is applied so no
          existing review becomes unmanageable mid-rollout. */}
      {missingTable && (
        <div className="pt-4 border-t border-border space-y-3">
          <h3 className="text-sm font-medium text-foreground">{c("legacyTitle")}</h3>
          <DashboardTestimonials />
        </div>
      )}
    </div>
  );
};

export default DashboardReviews;
