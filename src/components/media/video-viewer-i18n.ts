export type ViewerLang = "en" | "es" | "ru";

/** ES/EN/RU strings for the shared video viewer and its frame picker. */
export const VIEWER_COPY = {
  play: { en: "Play", es: "Reproducir", ru: "Воспроизвести" },
  pause: { en: "Pause", es: "Pausar", ru: "Пауза" },
  seek: { en: "Seek in the video", es: "Buscar en el vídeo", ru: "Перемотка видео" },
  time: { en: "Current time / duration", es: "Tiempo actual / duración", ru: "Текущее время / длительность" },
  useFrame: {
    en: "Use current frame as thumbnail",
    es: "Usar el fotograma actual como miniatura",
    ru: "Использовать текущий кадр как миниатюру",
  },
  framePreview: { en: "Selected frame", es: "Fotograma seleccionado", ru: "Выбранный кадр" },
  save: { en: "Save thumbnail", es: "Guardar miniatura", ru: "Сохранить миниатюру" },
  cancel: { en: "Cancel", es: "Cancelar", ru: "Отмена" },
  saving: { en: "Saving…", es: "Guardando…", ru: "Сохранение…" },
  saved: { en: "Thumbnail saved", es: "Miniatura guardada", ru: "Миниатюра сохранена" },
  saveFailed: {
    en: "Could not save the thumbnail.",
    es: "No se pudo guardar la miniatura.",
    ru: "Не удалось сохранить миниатюру.",
  },
  frameFailedCors: {
    en: "This video cannot be captured by the browser for security reasons.",
    es: "El navegador no puede capturar este vídeo por motivos de seguridad.",
    ru: "Браузер не может захватить кадр этого видео по соображениям безопасности.",
  },
  frameFailedNotReady: {
    en: "Play or scrub the video first, then capture a frame.",
    es: "Reproduce o desplaza el vídeo y captura después un fotograma.",
    ru: "Сначала запустите или перемотайте видео, затем сделайте снимок кадра.",
  },
  frameFailedEncode: {
    en: "Could not capture this frame. Try another moment.",
    es: "No se pudo capturar este fotograma. Prueba en otro momento.",
    ru: "Не удалось захватить кадр. Попробуйте другой момент.",
  },
  keyboardHint: {
    en: "Space plays or pauses, arrow keys seek.",
    es: "Espacio reproduce o pausa, las flechas desplazan.",
    ru: "Пробел — воспроизведение/пауза, стрелки — перемотка.",
  },
} as const;

export type ViewerKey = keyof typeof VIEWER_COPY;

export const makeViewerL = (lang: ViewerLang) => (key: ViewerKey) => VIEWER_COPY[key][lang];
export type ViewerT = ReturnType<typeof makeViewerL>;
