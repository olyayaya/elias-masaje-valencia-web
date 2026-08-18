import type { UnsupportedReason } from "@/lib/media-compress";

export type Lang = "en" | "es" | "ru";

/** Shared ES/EN/RU strings for the whole Library section (list, filters, converter). */
export const COPY = {
  // ---- upload ----------------------------------------------------------
  dropHere: { en: "Drop photos or videos here or", es: "Suelta fotos o vídeos aquí o", ru: "Перетащите фото или видео сюда или" },
  browse: { en: "browse", es: "explora", ru: "выберите" },
  formats: { en: "JPG, PNG, WebP · MP4, MOV, M4V, WebM (max 250 MB)", es: "JPG, PNG, WebP · MP4, MOV, M4V, WebM (máx. 250 MB)", ru: "JPG, PNG, WebP · MP4, MOV, M4V, WebM (до 250 МБ)" },
  uploading: { en: "Uploading…", es: "Subiendo…", ru: "Загрузка…" },
  uploaded: { en: "Optimized & uploaded (saved {n})", es: "Optimizada y subida (ahorro {n})", ru: "Оптимизировано и загружено (экономия {n})" },
  uploadedVideo: { en: "Video uploaded: {n}", es: "Vídeo subido: {n}", ru: "Видео загружено: {n}" },
  uploadFailed: { en: "Upload failed", es: "Error al subir", ru: "Ошибка загрузки" },
  uploadCancelled: { en: "Upload cancelled", es: "Subida cancelada", ru: "Загрузка отменена" },
  uploadingFile: { en: "Uploading {f} — {p}%", es: "Subiendo {f} — {p}%", ru: "Загрузка {f} — {p}%" },
  cancel: { en: "Cancel", es: "Cancelar", ru: "Отмена" },
  tooBig: { en: "{f} is larger than {m} MB", es: "{f} supera los {m} MB", ru: "{f} больше {m} МБ" },
  skippedUnsupported: { en: "{f} is not a supported photo or video", es: "{f} no es una foto o vídeo compatible", ru: "{f} — неподдерживаемый файл" },

  // ---- remove audio on upload -----------------------------------------
  removeAudio: {
    en: "Remove audio from video before upload",
    es: "Eliminar audio del vídeo antes de subirlo",
    ru: "Удалить аудио из видео перед загрузкой",
  },
  removeAudioHint: {
    en: "Applies to videos only. The audio track is removed in your browser first — the version with sound is never uploaded. Video quality is untouched.",
    es: "Solo afecta a los vídeos. La pista de audio se elimina en tu navegador antes de subir: la versión con sonido nunca se envía. La calidad del vídeo no cambia.",
    ru: "Только для видео. Аудиодорожка удаляется в браузере до загрузки — версия со звуком никогда не отправляется. Качество видео не меняется.",
  },
  removingAudio: { en: "Removing audio from {f} — {p}%", es: "Eliminando audio de {f} — {p}%", ru: "Удаление аудио из {f} — {p}%" },
  audioRemoved: { en: "Audio removed from {f}", es: "Audio eliminado de {f}", ru: "Аудио удалено из {f}" },
  noAudioTrack: { en: "{f} had no audio track — uploaded without audio", es: "{f} no tenía pista de audio: se subió sin audio", ru: "В {f} не было аудиодорожки — видео загружено без аудио" },
  audioRemovalFailed: { en: "Could not remove the audio from {f} — the file was not uploaded", es: "No se pudo eliminar el audio de {f}: el archivo no se subió", ru: "Не удалось удалить аудио из {f} — файл не загружен" },
  audioRemovalCancelled: { en: "Audio removal cancelled — {f} was not uploaded", es: "Eliminación de audio cancelada: {f} no se subió", ru: "Удаление аудио отменено — {f} не загружен" },
  audioRemovalUnsupported: {
    en: "This browser cannot remove audio (WebAssembly unavailable) — {f} was not uploaded",
    es: "Este navegador no puede eliminar el audio (WebAssembly no disponible): {f} no se subió",
    ru: "Этот браузер не может удалить аудио (нет WebAssembly) — {f} не загружен",
  },


  // ---- library / tabs --------------------------------------------------
  library: { en: "Library", es: "Biblioteca", ru: "Библиотека" },
  all: { en: "All", es: "Todo", ru: "Все" },
  photos: { en: "Photos", es: "Fotos", ru: "Фото" },
  videos: { en: "Videos", es: "Vídeos", ru: "Видео" },
  other: { en: "Other", es: "Otros", ru: "Другие" },
  files: { en: "{n} files", es: "{n} archivos", ru: "{n} файлов" },
  showing: { en: "Showing {n} of {t}", es: "Mostrando {n} de {t}", ru: "Показано {n} из {t}" },
  empty: { en: "No files match these filters.", es: "Ningún archivo coincide con estos filtros.", ru: "Нет файлов по этим фильтрам." },

  // ---- filters ---------------------------------------------------------
  search: { en: "Search by name", es: "Buscar por nombre", ru: "Поиск по имени" },
  filters: { en: "Filters", es: "Filtros", ru: "Фильтры" },
  reset: { en: "Reset", es: "Restablecer", ru: "Сбросить" },
  fileType: { en: "File type", es: "Tipo de archivo", ru: "Тип файла" },
  sizeRange: { en: "Size (MB)", es: "Tamaño (MB)", ru: "Размер (МБ)" },
  min: { en: "Min", es: "Mín", ru: "Мин" },
  max: { en: "Max", es: "Máx", ru: "Макс" },
  dateRange: { en: "Upload date", es: "Fecha de subida", ru: "Дата загрузки" },
  usage: { en: "Usage", es: "Uso", ru: "Использование" },
  used: { en: "In use", es: "En uso", ru: "Используется" },
  unused: { en: "Unused", es: "Sin usar", ru: "Не используется" },
  unknownUsage: { en: "Not checked", es: "Sin comprobar", ru: "Не проверено" },
  checkUsage: { en: "Check usage", es: "Comprobar uso", ru: "Проверить использование" },
  checkingUsage: { en: "Checking usage…", es: "Comprobando uso…", ru: "Проверка использования…" },
  usageFailed: { en: "Usage scan failed", es: "Error al comprobar el uso", ru: "Не удалось проверить использование" },
  optimization: { en: "Optimization", es: "Optimización", ru: "Оптимизация" },
  optimized: { en: "Optimized", es: "Optimizada", ru: "Оптимизировано" },
  canOptimize: { en: "Can be optimized", es: "Se puede optimizar", ru: "Можно оптимизировать" },
  notAnalyzed: { en: "Not analyzed", es: "Sin analizar", ru: "Не анализировалось" },
  unsupported: { en: "Not optimizable", es: "No optimizable", ru: "Нельзя оптимизировать" },
  sortBy: { en: "Sort", es: "Orden", ru: "Сортировка" },
  newest: { en: "Newest first", es: "Más recientes", ru: "Сначала новые" },
  oldest: { en: "Oldest first", es: "Más antiguos", ru: "Сначала старые" },
  nameAsc: { en: "Name A–Z", es: "Nombre A–Z", ru: "Имя А–Я" },
  nameDesc: { en: "Name Z–A", es: "Nombre Z–A", ru: "Имя Я–А" },
  sizeDesc: { en: "Largest first", es: "Más grandes", ru: "Сначала большие" },
  sizeAsc: { en: "Smallest first", es: "Más pequeños", ru: "Сначала маленькие" },

  // ---- row actions -----------------------------------------------------
  compress: { en: "Smart compress", es: "Compresión inteligente", ru: "Умное сжатие" },
  convert: { en: "Convert video", es: "Convertir vídeo", ru: "Конвертировать видео" },
  preview: { en: "Preview", es: "Vista previa", ru: "Предпросмотр" },
  rename: { en: "Rename", es: "Renombrar", ru: "Переименовать" },
  copyUrl: { en: "Copy URL", es: "Copiar URL", ru: "Копировать ссылку" },
  del: { en: "Delete", es: "Eliminar", ru: "Удалить" },
  already: { en: "Image is already compressed — nothing was changed", es: "La imagen ya está comprimida: no se cambió nada", ru: "Изображение уже сжато — ничего не изменено" },
  compressed: { en: "Compressed: {a} → {b} (−{p}%)", es: "Comprimida: {a} → {b} (−{p}%)", ru: "Сжато: {a} → {b} (−{p}%)" },
  linksUpdated: { en: "{n} link(s) updated", es: "{n} enlace(s) actualizados", ru: "обновлено ссылок: {n}" },
  compressFailed: { en: "Compression failed", es: "Error al comprimir", ru: "Ошибка сжатия" },
  cannotCompress: { en: "Cannot compress {f} — {r}", es: "No se puede comprimir {f} — {r}", ru: "Нельзя сжать {f} — {r}" },
  renamedTo: { en: "Renamed to {n}", es: "Renombrada a {n}", ru: "Переименовано в {n}" },
  renameFailed: { en: "Rename failed", es: "Error al renombrar", ru: "Ошибка переименования" },
  renameTitle: { en: "Rename file", es: "Renombrar archivo", ru: "Переименовать файл" },
  renameDesc: {
    en: "All links to this file in your content are updated in a single transaction, and old versions in the change history keep resolving to the new name.",
    es: "Todos los enlaces a este archivo se actualizan en una sola transacción, y las versiones antiguas del historial siguen apuntando al nuevo nombre.",
    ru: "Все ссылки на этот файл обновляются одной транзакцией, а старые версии в истории продолжают указывать на новое имя.",
  },
  currentName: { en: "Current name", es: "Nombre actual", ru: "Текущее имя" },
  newName: { en: "New name", es: "Nombre nuevo", ru: "Новое имя" },
  close: { en: "Close", es: "Cerrar", ru: "Закрыть" },
  errEmpty: { en: "Name cannot be empty", es: "El nombre no puede estar vacío", ru: "Имя не может быть пустым" },
  errPaths: { en: "Name cannot contain paths", es: "El nombre no puede contener rutas", ru: "Имя не может содержать пути" },
  errChars: { en: "Use letters, numbers, dot, dash and underscore only", es: "Usa solo letras, números, punto, guion y guion bajo", ru: "Только буквы, цифры, точка, дефис и подчёркивание" },
  errExt: { en: "Keep the {e} extension — change format via conversion", es: "Mantén la extensión {e}: cambia el formato con la conversión", ru: "Сохраните расширение {e} — формат меняется через конвертацию" },
  errSame: { en: "New name is identical", es: "El nombre nuevo es idéntico", ru: "Новое имя совпадает с текущим" },
  errExists: { en: "A file with that name already exists", es: "Ya existe un archivo con ese nombre", ru: "Файл с таким именем уже существует" },
  checkFailed: { en: "Couldn't verify where this file is used", es: "No se pudo comprobar dónde se usa este archivo", ru: "Не удалось проверить, где используется файл" },
  deleted: { en: "Deleted {n}", es: "Eliminada {n}", ru: "Удалено: {n}" },
  deleteFailed: { en: "Delete failed", es: "Error al eliminar", ru: "Ошибка удаления" },
  nowInUse: { en: "File is now in use — deletion blocked", es: "El archivo está en uso: eliminación bloqueada", ru: "Файл используется — удаление заблокировано" },
  inUseTitle: { en: "This file is still in use", es: "Este archivo sigue en uso", ru: "Файл всё ещё используется" },
  deleteTitle: { en: "Delete {n}?", es: "¿Eliminar {n}?", ru: "Удалить {n}?" },
  inUseBody: {
    en: "“{n}” is referenced by {c} item(s). Replace the file there first — deletion is blocked to avoid breaking published content.",
    es: "«{n}» está referenciado por {c} elemento(s). Cámbialo allí primero: la eliminación está bloqueada para no romper el contenido publicado.",
    ru: "«{n}» используется в {c} элемент(ах). Сначала замените файл там — удаление заблокировано, чтобы не сломать опубликованный контент.",
  },
  deleteBody: {
    en: "No content references this file. Deleting it is permanent and cannot be undone.",
    es: "Ningún contenido usa este archivo. La eliminación es permanente y no se puede deshacer.",
    ru: "Ни один контент не ссылается на этот файл. Удаление необратимо.",
  },
  deletePermanently: { en: "Delete permanently", es: "Eliminar definitivamente", ru: "Удалить навсегда" },
  historyNote: {
    en: "Heads-up: {n} archived version(s) in the change history still reference this file. Restoring one of those after deletion would show a broken file. Live content is not affected.",
    es: "Aviso: {n} versión(es) archivadas del historial aún usan este archivo. Restaurar una de ellas tras la eliminación mostraría un archivo roto. El contenido publicado no se ve afectado.",
    ru: "Внимание: {n} архивных версий в истории ещё ссылаются на этот файл. Восстановление такой версии после удаления покажет битый файл. На опубликованный контент это не влияет.",
  },
  aliasNote: {
    en: "{n} archived version(s) referenced the old name — they now resolve to the new one automatically on restore.",
    es: "{n} versión(es) archivadas usaban el nombre anterior: ahora se resuelven automáticamente al nuevo al restaurar.",
    ru: "{n} архивных версий ссылались на старое имя — при восстановлении они автоматически указывают на новое.",
  },
  leftover: {
    en: "Links updated, but the old file could not be removed: {m}",
    es: "Enlaces actualizados, pero no se pudo eliminar el archivo antiguo: {m}",
    ru: "Ссылки обновлены, но старый файл не удалось удалить: {m}",
  },

  // ---- video converter -------------------------------------------------
  convertTitle: { en: "Convert video locally", es: "Convertir vídeo localmente", ru: "Локальная конвертация видео" },
  convertDesc: {
    en: "The video is re-encoded in your browser — nothing is sent anywhere until you replace the file. Large videos take a while and use a lot of memory.",
    es: "El vídeo se recodifica en tu navegador: no se envía nada hasta que reemplaces el archivo. Los vídeos grandes tardan y consumen mucha memoria.",
    ru: "Видео перекодируется прямо в браузере — ничего не отправляется, пока вы не замените файл. Большие видео обрабатываются долго и требуют много памяти.",
  },
  loadingEngine: { en: "Loading the converter…", es: "Cargando el conversor…", ru: "Загрузка конвертера…" },
  engineFailed: { en: "The converter could not be loaded in this browser", es: "No se pudo cargar el conversor en este navegador", ru: "Конвертер не удалось загрузить в этом браузере" },
  notSupported: { en: "This browser cannot run the local converter (WebAssembly unavailable)", es: "Este navegador no puede ejecutar el conversor local (WebAssembly no disponible)", ru: "Этот браузер не поддерживает локальный конвертер (нет WebAssembly)" },
  source: { en: "Source", es: "Original", ru: "Исходник" },
  format: { en: "Format", es: "Formato", ru: "Формат" },
  resolution: { en: "Resolution", es: "Resolución", ru: "Разрешение" },
  quality: { en: "Quality", es: "Calidad", ru: "Качество" },
  qHigh: { en: "High", es: "Alta", ru: "Высокое" },
  qBalanced: { en: "Balanced", es: "Equilibrada", ru: "Сбалансированное" },
  qSmall: { en: "Smallest file", es: "Archivo más pequeño", ru: "Минимальный размер" },
  original: { en: "Original", es: "Original", ru: "Как есть" },
  smartPreset: { en: "Use recommended settings", es: "Usar ajustes recomendados", ru: "Рекомендуемые настройки" },
  noUpscale: { en: "Videos are never upscaled — a smaller source keeps its size.", es: "Los vídeos nunca se amplían: un original menor conserva su tamaño.", ru: "Видео никогда не увеличивается — меньший исходник сохраняет размер." },
  startConvert: { en: "Convert", es: "Convertir", ru: "Конвертировать" },
  converting: { en: "Converting… {p}%", es: "Convirtiendo… {p}%", ru: "Конвертация… {p}%" },
  convertFailed: { en: "Conversion failed", es: "Error al convertir", ru: "Ошибка конвертации" },
  convertCancelled: { en: "Conversion cancelled", es: "Conversión cancelada", ru: "Конвертация отменена" },
  result: { en: "Result", es: "Resultado", ru: "Результат" },
  saving: { en: "{a} → {b} (−{p}%)", es: "{a} → {b} (−{p}%)", ru: "{a} → {b} (−{p}%)" },
  biggerResult: { en: "The converted file is not smaller. Replacing is disabled — try a lower resolution or quality.", es: "El archivo convertido no es más pequeño. Reemplazar está desactivado: prueba menor resolución o calidad.", ru: "Результат не меньше исходника. Замена отключена — попробуйте меньшее разрешение или качество." },
  alreadyOptimizedVideo: { en: "This video is already well compressed (under 10% saving). Replacing is disabled.", es: "Este vídeo ya está bien comprimido (menos del 10% de ahorro). Reemplazar está desactivado.", ru: "Видео уже хорошо сжато (экономия меньше 10%). Замена отключена." },
  replaceOriginal: { en: "Replace original", es: "Reemplazar original", ru: "Заменить оригинал" },
  replacing: { en: "Replacing… {p}%", es: "Reemplazando… {p}%", ru: "Замена… {p}%" },
  replaced: { en: "Replaced {n}", es: "Reemplazado {n}", ru: "Заменено: {n}" },
  replaceFailed: { en: "Replacement failed", es: "Error al reemplazar", ru: "Ошибка замены" },
  downloadResult: { en: "Download result", es: "Descargar resultado", ru: "Скачать результат" },
  memoryWarning: {
    en: "This video is large. Converting it may take several minutes and can run out of memory — keep this tab in the foreground.",
    es: "Este vídeo es grande. Convertirlo puede tardar varios minutos y agotar la memoria: mantén esta pestaña en primer plano.",
    ru: "Видео большое. Конвертация может занять несколько минут и исчерпать память — держите вкладку активной.",
  },
  tooLargeConvert: { en: "Videos over {m} MB cannot be converted in the browser", es: "Los vídeos de más de {m} MB no se pueden convertir en el navegador", ru: "Видео больше {m} МБ нельзя конвертировать в браузере" },
  convertNote: {
    en: "Replacing keeps every link working: references are rewritten in one transaction and archived versions resolve the old name automatically.",
    es: "Al reemplazar, todos los enlaces siguen funcionando: las referencias se reescriben en una transacción y las versiones archivadas resuelven el nombre anterior automáticamente.",
    ru: "При замене все ссылки продолжают работать: они переписываются одной транзакцией, а архивные версии автоматически разрешают старое имя.",
  },

  // ---- edit / replace + unified processing dialog ----------------------
  editReplace: { en: "Edit or replace", es: "Editar o reemplazar", ru: "Изменить или заменить" },
  kindMismatchPhoto: {
    en: "{f} is not a photo — a photo can only be replaced by another photo",
    es: "{f} no es una foto: una foto solo puede reemplazarse por otra foto",
    ru: "{f} — не фото: фото можно заменить только другим фото",
  },
  kindMismatchVideo: {
    en: "{f} is not a video — a video can only be replaced by another video",
    es: "{f} no es un vídeo: un vídeo solo puede reemplazarse por otro vídeo",
    ru: "{f} — не видео: видео можно заменить только другим видео",
  },
  processTitle: { en: "Prepare media", es: "Preparar archivo", ru: "Подготовка файла" },
  processReplaceTitle: { en: "Edit or replace {n}", es: "Editar o reemplazar {n}", ru: "Изменить или заменить {n}" },
  processDesc: {
    en: "Everything is processed in your browser. Nothing in the library changes until you press Apply.",
    es: "Todo se procesa en tu navegador. Nada cambia en la biblioteca hasta que pulses Aplicar.",
    ru: "Всё обрабатывается в браузере. В библиотеке ничего не меняется, пока вы не нажмёте «Применить».",
  },
  queuePosition: { en: "File {i} of {t}", es: "Archivo {i} de {t}", ru: "Файл {i} из {t}" },
  modeSmart: { en: "Recommended", es: "Recomendado", ru: "Рекомендуемые" },
  modeAdvanced: { en: "Advanced", es: "Avanzado", ru: "Расширенные" },
  originalLabel: { en: "Original", es: "Original", ru: "Оригинал" },
  selectedFile: { en: "Selected file", es: "Archivo seleccionado", ru: "Выбранный файл" },
  willReplace: { en: "Will replace: {n}", es: "Sustituirá: {n}", ru: "Заменит файл: {n}" },
  analyzingFile: { en: "Reading the selected file…", es: "Leyendo el archivo seleccionado…", ru: "Чтение выбранного файла…" },
  resultLabel: { en: "Result", es: "Resultado", ru: "Результат" },
  notProcessed: { en: "Not processed yet", es: "Sin procesar", ru: "Ещё не обработано" },

  process: { en: "Process", es: "Procesar", ru: "Обработать" },
  processing: { en: "Processing… {p}%", es: "Procesando… {p}%", ru: "Обработка… {p}%" },
  apply: { en: "Apply", es: "Aplicar", ru: "Применить" },
  applying: { en: "Applying… {p}%", es: "Aplicando… {p}%", ru: "Применение… {p}%" },
  applyReplace: { en: "Replace original", es: "Reemplazar original", ru: "Заменить оригинал" },
  replaceFile: { en: "Replace file", es: "Reemplazar archivo", ru: "Заменить файл" },
  keepOriginal: { en: "Keep original", es: "Mantener el original", ru: "Вернуться к оригиналу" },
  keptOriginal: {
    en: "Result discarded — the original file is untouched",
    es: "Resultado descartado: el archivo original no se ha modificado",
    ru: "Результат отменён — исходный файл не изменён",
  },
  resetSettings: { en: "Reset", es: "Restablecer", ru: "Сбросить" },
  skipFile: { en: "Skip this file", es: "Omitir este archivo", ru: "Пропустить файл" },
  applyToAll: { en: "Use these settings for the remaining files of the same type", es: "Usar estos ajustes para los demás archivos del mismo tipo", ru: "Применить эти настройки к остальным файлам того же типа" },
  sizeLimit: { en: "Size (longest edge)", es: "Tamaño (lado mayor)", ru: "Размер (длинная сторона)" },
  customSize: { en: "Custom (px)", es: "Personalizado (px)", ru: "Свой размер (px)" },
  pngLossless: {
    en: "PNG is lossless here — there is no quality setting, only the size limit.",
    es: "PNG es sin pérdidas: no hay ajuste de calidad, solo el límite de tamaño.",
    ru: "PNG сохраняется без потерь — настройки качества нет, только ограничение размера.",
  },
  noUpscalePhoto: { en: "Photos are never enlarged.", es: "Las fotos nunca se amplían.", ru: "Фото никогда не увеличивается." },
  alphaWarning: {
    en: "JPEG cannot store transparency — transparent areas are filled with the colour below.",
    es: "JPEG no admite transparencia: las zonas transparentes se rellenan con el color de abajo.",
    ru: "JPEG не поддерживает прозрачность — прозрачные области заливаются выбранным цветом.",
  },
  background: { en: "Background", es: "Fondo", ru: "Фон" },
  biggerWarning: {
    en: "The result is not smaller than the original ({a} → {b}). Apply it anyway?",
    es: "El resultado no es más pequeño que el original ({a} → {b}). ¿Aplicarlo igualmente?",
    ru: "Результат не меньше оригинала ({a} → {b}). Всё равно применить?",
  },
  fps: { en: "Frame rate", es: "Fotogramas", ru: "Частота кадров" },
  speed: { en: "Compression effort", es: "Nivel de compresión", ru: "Уровень сжатия" },
  speedFast: { en: "Fast", es: "Rápida", ru: "Быстро" },
  speedBalanced: { en: "Balanced", es: "Equilibrada", ru: "Сбалансированно" },
  speedMax: { en: "Maximum compression", es: "Compresión máxima", ru: "Максимальное сжатие" },
  rateControl: { en: "Rate control", es: "Control de tasa", ru: "Управление битрейтом" },
  rateCrf: { en: "Constant quality (CRF)", es: "Calidad constante (CRF)", ru: "Постоянное качество (CRF)" },
  rateBitrate: { en: "Target bitrate", es: "Bitrate objetivo", ru: "Целевой битрейт" },
  crfHint: { en: "Lower = better quality and a larger file.", es: "Menor = mejor calidad y archivo más grande.", ru: "Меньше = лучше качество и больше файл." },
  bitrateKbps: { en: "Bitrate (kbps)", es: "Bitrate (kbps)", ru: "Битрейт (кбит/с)" },
  estimatedSize: { en: "Estimated size: {s}", es: "Tamaño estimado: {s}", ru: "Ожидаемый размер: {s}" },
  audioBitrate: { en: "Audio bitrate (kbps)", es: "Bitrate de audio (kbps)", ru: "Битрейт аудио (кбит/с)" },
  removeAudioOpt: { en: "Remove audio", es: "Eliminar audio", ru: "Удалить звук" },
  movNotRecommended: {
    en: "MOV is not recommended for the web — use MP4 or WebM for anything published.",
    es: "MOV no se recomienda para la web: usa MP4 o WebM para contenido publicado.",
    ru: "MOV не рекомендуется для веба — для публикации используйте MP4 или WebM.",
  },
  movGalleryBlocked: {

    en: "This video is published in the Gallery — only MP4 or WebM may replace it.",
    es: "Este vídeo está publicado en la Galería: solo MP4 o WebM pueden reemplazarlo.",
    ru: "Это видео опубликовано в Галерее — заменить его можно только MP4 или WebM.",
  },
  processFailed: { en: "Processing failed", es: "Error al procesar", ru: "Ошибка обработки" },
  appliedOk: { en: "Applied: {n}", es: "Aplicado: {n}", ru: "Применено: {n}" },
  restoreUnavailable: {
    en: "Once applied, the previous version is not kept — check the result before applying.",
    es: "Una vez aplicado, la versión anterior no se conserva: revisa el resultado antes de aplicar.",
    ru: "После применения предыдущая версия не сохраняется — проверьте результат до применения.",
  },
  openingFile: { en: "Opening {f}…", es: "Abriendo {f}…", ru: "Открытие {f}…" },
  processBeforeUpload: {
    en: "Files open in the editor first — nothing is uploaded until you apply.",
    es: "Los archivos se abren primero en el editor: nada se sube hasta que apliques.",
    ru: "Файлы сначала открываются в редакторе — ничего не загружается до применения.",
  },
  openFailed: { en: "Could not open {f}", es: "No se pudo abrir {f}", ru: "Не удалось открыть {f}" },
  tooBigEngine: {
    en: "This video is larger than {m} MB — the in-browser encoder cannot process it. Upload a smaller file or compress it outside the browser.",
    es: "Este vídeo supera los {m} MB: el codificador del navegador no puede procesarlo. Sube un archivo más pequeño o comprímelo fuera del navegador.",
    ru: "Видео больше {m} МБ — браузерный кодировщик не может его обработать. Загрузите файл меньше или сожмите его вне браузера.",
  },
  resultBigger: {
    en: "The result ({b}) is LARGER than the selected file ({a}).",
    es: "El resultado ({b}) es MÁS GRANDE que el archivo seleccionado ({a}).",
    ru: "Результат ({b}) БОЛЬШЕ выбранного файла ({a}).",
  },
  resultMarginal: {
    en: "The result ({b}) is only slightly smaller than the selected file ({a}).",
    es: "El resultado ({b}) es solo un poco más pequeño que el archivo seleccionado ({a}).",
    ru: "Результат ({b}) лишь немного меньше выбранного файла ({a}).",
  },
  movReplaceBlocked: {
    en: "An existing library video can only be replaced by MP4 or WebM.",
    es: "Un vídeo existente solo puede reemplazarse por MP4 o WebM.",
    ru: "Существующее видео можно заменить только на MP4 или WebM.",
  },
  showOriginal: { en: "Original", es: "Original", ru: "Оригинал" },
  showResult: { en: "Result", es: "Resultado", ru: "Результат" },
  noRollback: {
    en: "After Apply the previous version is not kept — long-term rollback is not available yet, so check the comparison first.",
    es: "Tras aplicar no se conserva la versión anterior: todavía no hay reversión a largo plazo, revisa antes la comparación.",
    ru: "После применения предыдущая версия не сохраняется — долговременный откат пока недоступен, сначала сверьте сравнение.",
  },
};

export const REASONS: Record<UnsupportedReason, Record<Lang, string>> = {
  gif: {
    en: "GIF animation cannot be re-encoded without losing the animation",
    es: "una animación GIF no se puede recomprimir sin perder la animación",
    ru: "GIF-анимацию нельзя пережать без потери анимации",
  },
  svg: {
    en: "SVG is a vector format and does not need raster compression",
    es: "SVG es vectorial y no necesita compresión de mapa de bits",
    ru: "SVG — векторный формат, растровое сжатие не требуется",
  },
  avif: {
    en: "AVIF is already a modern compressed format",
    es: "AVIF ya es un formato comprimido moderno",
    ru: "AVIF уже современный сжатый формат",
  },
  notImage: { en: "this file is not an image", es: "este archivo no es una imagen", ru: "это не изображение" },
  decode: {
    en: "this image could not be decoded in the browser",
    es: "esta imagen no se pudo decodificar en el navegador",
    ru: "изображение не удалось декодировать в браузере",
  },
  tooLarge: {
    en: "the re-encoded image exceeds the upload limit",
    es: "la imagen recomprimida supera el límite de subida",
    ru: "пережатое изображение превышает лимит загрузки",
  },
};

export const fill = (s: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(String(v)), s);

export const makeL =
  (lang: Lang) =>
  (k: keyof typeof COPY, vars: Record<string, string | number> = {}) =>
    fill(COPY[k][lang] ?? COPY[k].en, vars);

export type LibraryT = ReturnType<typeof makeL>;

export const toLang = (locale: string): Lang =>
  (["en", "es", "ru"] as const).includes(locale as Lang) ? (locale as Lang) : "en";
