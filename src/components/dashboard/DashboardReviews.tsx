import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowDown, ArrowUp, ExternalLink, Eye, EyeOff, Loader2, Pin, PinOff, Star, Upload,
} from "lucide-react";
import { useI18n } from "@/i18n/context";
import {
  REVIEW_SORTS, REVIEW_SOURCES, TRIPADVISOR_PROFILE_URL, parseReviewImport, planImport, reviewSettingsTable,
  reviewsTable, sortReviews,
  type ParsedImportRow, type Review, type ReviewSort, type ReviewSource,
} from "@/lib/reviews";
import { useAdminReviews, reviewKeys } from "@/hooks/use-reviews";
import DashboardCard from "./DashboardCard";
import DashboardTestimonials from "./DashboardTestimonials";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const COPY = {
  intro: {
    en: "Real reviews you add yourself by importing a CSV or JSON file. There is no automatic connection to Google or TripAdvisor: nothing is fetched, copied or written by the site.",
    es: "Reseñas reales que añades tú importando un archivo CSV o JSON. No hay conexión automática con Google ni TripAdvisor: la web no descarga, copia ni escribe nada.",
    ru: "Реальные отзывы, которые вы добавляете сами, импортируя файл CSV или JSON. Автоматического подключения к Google или TripAdvisor нет: сайт ничего не загружает, не копирует и не пишет сам.",
  },
  missingTable: {
    en: "The reviews storage is not set up yet. Ask your developer to apply the pending reviews migration. The legacy editor below stays available until then.",
    es: "El almacenamiento de reseñas aún no está configurado. Pide que se aplique la migración pendiente. Mientras tanto sigue disponible el editor anterior.",
    ru: "Хранилище отзывов ещё не настроено. Попросите применить ожидающую миграцию. До этого доступен прежний редактор.",
  },
  legacyTitle: { en: "Legacy reviews", es: "Reseñas anteriores", ru: "Прежние отзывы" },
  search: { en: "Search author or text", es: "Buscar autor o texto", ru: "Поиск по автору или тексту" },
  sourceAll: { en: "All sources", es: "Todas las fuentes", ru: "Все источники" },
  sourceGoogle: { en: "Google", es: "Google", ru: "Google" },
  sourceManual: { en: "Manual import", es: "Importación manual", ru: "Ручной импорт" },
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
    en: "No reviews imported yet. Connect a source or import an official export below.",
    es: "Aún no hay reseñas importadas. Conecta una fuente o importa una exportación oficial abajo.",
    ru: "Отзывы ещё не импортированы. Подключите источник или импортируйте официальный экспорт ниже.",
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
  sourcesToggle: { en: "Show reviews from {v}", es: "Mostrar reseñas de {v}", ru: "Показывать отзывы из {v}" },
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
  lastAttempt: { en: "Last attempt: {v}", es: "Último intento: {v}", ru: "Последняя попытка: {v}" },
  counters: { en: "{i} new · {u} updated · {s} skipped", es: "{i} nuevas · {u} actualizadas · {s} omitidas", ru: "{i} новых · {u} обновлено · {s} пропущено" },
  rateLimited: { en: "Please wait {n}s before syncing this source again.", es: "Espera {n}s antes de volver a sincronizar esta fuente.", ru: "Подождите {n} с перед повторной синхронизацией." },
  tripadvisorTitle: { en: "TripAdvisor", es: "TripAdvisor", ru: "TripAdvisor" },
  tripadvisorBody: {
    en: "TripAdvisor reviews are not imported or shown on the site. Their Content API terms do not allow filtering or sorting their reviews, or mixing them with reviews from other sources. Showing their content needs the official TripAdvisor widget or a separate written licence. Until then the profile is linked only.",
    es: "Las reseñas de TripAdvisor no se importan ni se muestran en la web. Sus condiciones de la Content API no permiten filtrar ni ordenar sus reseñas, ni mezclarlas con reseñas de otras fuentes. Para mostrar su contenido hace falta el widget oficial de TripAdvisor o una licencia escrita aparte. Hasta entonces solo se enlaza el perfil.",
    ru: "Отзывы TripAdvisor не импортируются и не показываются на сайте. Условия их Content API запрещают фильтровать и сортировать их отзывы, а также смешивать их с отзывами других источников. Для показа их контента нужен официальный виджет TripAdvisor или отдельное письменное разрешение. Пока доступна только ссылка на профиль.",
  },
  tripadvisorOpen: { en: "Open TripAdvisor profile", es: "Abrir perfil de TripAdvisor", ru: "Открыть профиль TripAdvisor" },

  lastSync: { en: "Last sync: {v}", es: "Última sincronización: {v}", ru: "Последняя синхронизация: {v}" },

  importTitle: { en: "Import reviews (CSV or JSON)", es: "Importar reseñas (CSV o JSON)", ru: "Импорт отзывов (CSV или JSON)" },
  importHint: {
    en: "CSV or JSON with the columns source, external_review_id, author_name, rating, review_text, reviewed_at, original_url. Allowed sources: google, manual. Copied TripAdvisor content is rejected. Nothing is saved until you check the rights box and confirm.",
    es: "CSV o JSON con las columnas source, external_review_id, author_name, rating, review_text, reviewed_at, original_url. Fuentes permitidas: google, manual. El contenido copiado de TripAdvisor se rechaza. No se guarda nada hasta que marques la casilla de derechos y confirmes.",
    ru: "CSV или JSON со столбцами source, external_review_id, author_name, rating, review_text, reviewed_at, original_url. Допустимые источники: google, manual. Скопированный контент TripAdvisor отклоняется. Ничего не сохраняется, пока вы не отметите подтверждение прав и не подтвердите импорт.",
  },
  importSummary: {
    en: "{n} valid rows · {fresh} new · {upd} already stored (will be refreshed) · {dupe} duplicates in the file skipped",
    es: "{n} filas válidas · {fresh} nuevas · {upd} ya guardadas (se actualizarán) · {dupe} duplicados del archivo omitidos",
    ru: "Корректных строк: {n} · новых: {fresh} · уже сохранено: {upd} (будут обновлены) · дубликатов в файле пропущено: {dupe}",
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
  importNeedsRights: {
    en: "Tick the confirmation above to enable the import.",
    es: "Marca la confirmación de arriba para poder importar.",
    ru: "Отметьте подтверждение выше, чтобы включить импорт.",
  },
  colAuthor: { en: "Author", es: "Autor", ru: "Автор" },
  colRating: { en: "Rating", es: "Valoración", ru: "Оценка" },
  colSource: { en: "Source", es: "Fuente", ru: "Источник" },
  colDate: { en: "Date", es: "Fecha", ru: "Дата" },
  colText: { en: "Review", es: "Reseña", ru: "Отзыв" },
  colState: { en: "Status", es: "Estado", ru: "Статус" },
  rowNew: { en: "New", es: "Nueva", ru: "Новая" },
  rowUpdate: { en: "Update", es: "Actualización", ru: "Обновление" },
  lastImport: { en: "Last import: {v}", es: "Última importación: {v}", ru: "Последний импорт: {v}" },
  neverImported: { en: "never", es: "nunca", ru: "никогда" },
  choose: { en: "Choose file", es: "Elegir archivo", ru: "Выбрать файл" },
  importPreview: { en: "{n} valid rows ready to import", es: "{n} filas válidas listas", ru: "Готово к импорту строк: {n}" },
  importConfirm: { en: "Import {n}", es: "Importar {n}", ru: "Импортировать {n}" },
  importCancel: { en: "Discard", es: "Descartar", ru: "Отменить" },
  importDone: { en: "Imported {n} reviews", es: "{n} reseñas importadas", ru: "Импортировано отзывов: {n}" },
  importFailed: { en: "Import failed", es: "Error al importar", ru: "Ошибка импорта" },
  saveFailed: { en: "Failed to save", es: "Error al guardar", ru: "Не удалось сохранить" },
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

const STATUS_LABEL: Record<string, keyof typeof COPY> = {
  never: "statusNever",
  ok: "statusOk",
  error: "statusError",
  not_configured: "notConfigured",
  rate_limited: "statusRateLimited",
};

const SOURCE_LABEL: Record<ReviewSource, keyof typeof COPY> = {
  google: "sourceGoogle",
  manual: "sourceManual",
};

/** Secrets the server-side sync needs before it can run. Names only, never values. */
export const REQUIRED_SYNC_SECRETS: Record<"google", string[]> = {
  google: [
    "GOOGLE_BUSINESS_PROFILE_CLIENT_ID",
    "GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET",
    "GOOGLE_BUSINESS_PROFILE_REFRESH_TOKEN",
    "GOOGLE_BUSINESS_ACCOUNT_ID",
    "GOOGLE_BUSINESS_LOCATION_ID",
  ],
};

const Stars = ({ n }: { n: number }) => (
  <span className="flex gap-0.5" aria-label={`${n}/5`}>
    {Array.from({ length: 5 }).map((_, i) => (
      <Star key={i} size={12} className={i < n ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"} />
    ))}
  </span>
);

const DashboardReviews = () => {
  const c = useCopy();
  const qc = useQueryClient();
  const { items, settings, syncState, missingTable, isPending } = useAdminReviews();

  const [search, setSearch] = useState("");
  const [source, setSource] = useState<"all" | ReviewSource>("all");
  const [rating, setRating] = useState<"all" | number>("all");
  const [visibility, setVisibility] = useState<"all" | "visible" | "hidden">("all");
  const [sort, setSort] = useState<ReviewSort>("newest");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<null | ReviewSource>(null);
  const [syncStatus, setSyncStatus] = useState<Record<string, string>>({});
  const stateBySource = useMemo(() => {
    const map = new Map<string, ReviewSyncStateRow>();
    for (const row of syncState) map.set(row.source, row);
    return map;
  }, [syncState]);
  const [importRows, setImportRows] = useState<ParsedImportRow[] | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: reviewKeys.adminList });
    void qc.invalidateQueries({ queryKey: reviewKeys.publicList });
    void qc.invalidateQueries({ queryKey: reviewKeys.settings });
    void qc.invalidateQueries({ queryKey: reviewKeys.syncState });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = items.filter((r) => {
      if (source !== "all" && r.source !== source) return false;
      if (rating !== "all" && r.rating !== rating) return false;
      if (visibility === "visible" && !r.visible) return false;
      if (visibility === "hidden" && r.visible) return false;
      if (q && !`${r.author_name} ${r.review_text}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return sortReviews(list, sort);
  }, [items, search, source, rating, visibility, sort]);

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

  const toggleSource = (src: ReviewSource) => {
    const cur = settings.allowed_sources ?? [];
    const next = cur.includes(src) ? cur.filter((s) => s !== src) : [...cur, src];
    void saveSettings({ allowed_sources: next });
  };

  /** Manual order nudge: ±1 keeps the numbers readable for a non-technical owner. */
  const bumpPriority = (r: Review, delta: number) =>
    void patch(r.id, { manual_priority: Math.max(-999, Math.min(999, r.manual_priority + delta)) });

  /**
   * Server-side sync. The Edge Function owns every credential; the browser only
   * ever sees counters and a status string — never a token.
   */
  const runSync = async (src: ReviewSource) => {
    setSyncing(src);
    try {
      const { data, error } = await supabase.functions.invoke("reviews-sync", {
        body: { source: src },
      });
      if (error) throw error;
      const res = data as {
        status?: string;
        imported?: number;
        updated?: number;
        skipped?: number;
        error?: string;
      };
      if (res?.status === "rate_limited") {
        setSyncStatus((s) => ({ ...s, [src]: "rate_limited" }));
        toast.warning(c("rateLimited", { n: String((res as { retry_after?: number }).retry_after ?? 60) }));
        refresh();
        return;
      }
      if (res?.status === "compliance_required") {
        // Defensive: the UI offers no button for a blocked source.
        setSyncStatus((s) => ({ ...s, [src]: "compliance_required" }));
        toast.warning(c("tripadvisorBody"));
        return;
      }
      if (res?.status === "not_configured") {
        setSyncStatus((s) => ({ ...s, [src]: "not_configured" }));
        toast.warning(c("notConfigured"));
        refresh();
        return;
      }
      if (res?.status !== "ok") throw new Error(res?.error || "sync failed");
      setSyncStatus((s) => ({ ...s, [src]: "ok" }));
      toast.success(
        c("syncResult", {
          imported: String(res.imported ?? 0),
          updated: String(res.updated ?? 0),
          skipped: String(res.skipped ?? 0),
        }),
      );
      refresh();
    } catch {
      setSyncStatus((s) => ({ ...s, [src]: "error" }));
      toast.error(c("syncFailed"));
    } finally {
      setSyncing(null);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const { rows, errors } = parseReviewImport(text);
    setImportRows(rows);
    setImportErrors(errors);
  };

  const confirmImport = async () => {
    if (!importRows?.length) return;
    setImporting(true);
    // Upsert on (source, external_review_id): a re-import never duplicates and
    // never touches the moderator's own visible / pinned decisions.
    const { error } = await reviewsTable().upsert(
      importRows.map((r) => ({ ...r, last_synced_at: new Date().toISOString() })),
      { onConflict: "source,external_review_id", ignoreDuplicates: false },
    );
    setImporting(false);
    if (error) {
      toast.error(c("importFailed"));
      return;
    }
    toast.success(c("importDone", { n: String(importRows.length) }));
    setImportRows(null);
    setImportErrors([]);
    if (fileRef.current) fileRef.current.value = "";
    refresh();
  };

  const lastSync = useMemo(() => {
    const stamps = items.map((r) => r.last_synced_at).filter(Boolean) as string[];
    if (!stamps.length) return null;
    return stamps.sort().at(-1) ?? null;
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
          <div className="flex flex-wrap gap-3 pt-1">
            {REVIEW_SOURCES.map((src) => (
              <label key={src} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={(settings.allowed_sources ?? []).includes(src)}
                  disabled={missingTable}
                  onChange={() => toggleSource(src)}
                  aria-label={c("sourcesToggle", { v: c(SOURCE_LABEL[src]) })}
                />
                {c("sourcesToggle", { v: c(SOURCE_LABEL[src]) })}
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

      {/* -------------------------------------------------------- sources --- */}
      <DashboardCard title={c("syncTitle")}>
        <p className="text-xs text-muted-foreground mb-3">
          {c("lastSync", { v: lastSync ? new Date(lastSync).toLocaleString() : c("never") })}
        </p>
        <div className="space-y-3">
          {(["google"] as const).map((src) => (
            <div key={src} className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium w-28">{c(SOURCE_LABEL[src])}</span>
              <Button
                size="sm"
                variant="outline"
                disabled={syncing !== null || missingTable}
                onClick={() => void runSync(src)}
              >
                {syncing === src ? (
                  <Loader2 size={13} className="mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw size={13} className="mr-1.5" />
                )}
                {syncing === src ? c("syncing") : c("syncNow")}
              </Button>
              <span className="text-xs text-muted-foreground" data-testid={`sync-status-${src}`}>
                {c(STATUS_LABEL[stateBySource.get(src)?.status ?? "never"])}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {c("lastAttempt", {
                  v: stateBySource.get(src)?.last_attempt_at
                    ? new Date(stateBySource.get(src)!.last_attempt_at!).toLocaleString()
                    : c("never"),
                })}
              </span>
              <span className="text-[11px] text-muted-foreground" data-testid={`sync-counters-${src}`}>
                {c("counters", {
                  i: String(stateBySource.get(src)?.imported_count ?? 0),
                  u: String(stateBySource.get(src)?.updated_count ?? 0),
                  s: String(stateBySource.get(src)?.skipped_count ?? 0),
                })}
              </span>
              {(stateBySource.get(src)?.status === "not_configured" || syncStatus[src] === "not_configured") && (
                <span className="text-xs text-muted-foreground basis-full">
                  {c("notConfigured")} ({REQUIRED_SYNC_SECRETS[src].join(", ")})
                </span>
              )}
              {stateBySource.get(src)?.status === "error" && (
                <span className="text-xs text-destructive basis-full">
                  {stateBySource.get(src)?.error_message || c("syncFailed")}
                </span>
              )}
            </div>
          ))}
        </div>
      </DashboardCard>

      {/* --------------------------------------------- tripadvisor (link) --- */}
      {/* Deliberately separate from the Google/manual block above: no shared
          filters, no shared list, no imported content. */}
      <DashboardCard title={c("tripadvisorTitle")}>
        <p className="text-xs text-muted-foreground mb-3" data-testid="tripadvisor-compliance">
          {c("tripadvisorBody")}
        </p>
        <a
          href={TRIPADVISOR_PROFILE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-foreground underline underline-offset-2 hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded"
        >
          <ExternalLink size={13} /> {c("tripadvisorOpen")}
        </a>
      </DashboardCard>

      {/* --------------------------------------------------------- import --- */}
      <DashboardCard title={c("importTitle")}>
        <p className="text-xs text-muted-foreground mb-3">{c("importHint")}</p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.json,text/csv,application/json"
          aria-label={c("choose")}
          onChange={(e) => void onFile(e.target.files?.[0])}
          className="text-sm"
        />
        {importErrors.length > 0 && (
          <ul className="mt-3 text-xs text-destructive space-y-1" role="alert">
            {importErrors.slice(0, 10).map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        )}
        {importRows && importRows.length > 0 && (
          <div className="mt-3 space-y-2" data-testid="import-preview">
            <p className="text-xs text-muted-foreground">{c("importPreview", { n: String(importRows.length) })}</p>
            <ul className="text-xs text-muted-foreground space-y-1 max-h-40 overflow-y-auto">
              {importRows.slice(0, 5).map((r) => (
                <li key={`${r.source}-${r.external_review_id}`}>
                  {r.author_name} · {r.rating}★ · {r.review_text.slice(0, 60)}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button size="sm" disabled={importing || missingTable} onClick={() => void confirmImport()}>
                {importing ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Upload size={13} className="mr-1.5" />}
                {c("importConfirm", { n: String(importRows.length) })}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setImportRows(null);
                  setImportErrors([]);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              >
                {c("importCancel")}
              </Button>
            </div>
          </div>
        )}
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
          value={source}
          aria-label={c("sourceAll")}
          onChange={(e) => setSource(e.target.value as "all" | ReviewSource)}
        >
          <option value="all">{c("sourceAll")}</option>
          {REVIEW_SOURCES.map((s) => (
            <option key={s} value={s}>{c(SOURCE_LABEL[s])}</option>
          ))}
        </select>
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
                    {r.author_avatar_url && (
                      <img src={r.author_avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" loading="lazy" />
                    )}
                    <h4 className="text-sm font-medium text-foreground">{r.author_name}</h4>
                    <span className="text-[10px] px-2 py-0.5 bg-secondary text-muted-foreground rounded-full">
                      {c(SOURCE_LABEL[r.source])}
                    </span>
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
                    className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary"
                  >
                    {r.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button
                    onClick={() => void patch(r.id, { pinned: !r.pinned })}
                    disabled={busyId === r.id}
                    title={r.pinned ? c("unpin") : c("pin")}
                    aria-label={r.pinned ? c("unpin") : c("pin")}
                    className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary"
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
