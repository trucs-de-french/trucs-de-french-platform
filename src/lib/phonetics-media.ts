// Модель медіа для phonetics (картки "Écoutez et répétez.") — посилання
// може вести куди завгодно (власний файл, YouTube, Google Диск, прямий
// https-лінк), тож на відміну від старого єдиного audioUrl тут явне
// джерело (source) і явний тип відтворення (kind), а не визначення "на
// льоту" лише з вигляду URL (це й було причиною бага: YouTube-посилання
// йшло в kind="audio" і грало через <audio>, який такий URL не підтримує).

export type PhoneticsMediaSource = "upload" | "youtube" | "drive" | "url";
export type PhoneticsMediaKind = "audio" | "video";

export type PhoneticsMedia = {
  source: PhoneticsMediaSource;
  kind: PhoneticsMediaKind;
  url: string;
};

export function isHttpsUrl(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

// Підтримує watch?v=, youtu.be/, /shorts/, /embed/, із будь-якими зайвими
// параметрами в хвості (&t=, ?si= тощо) — стара extractYoutubeId у
// src/lib/video.ts не знала про /shorts/, тому посилання на Shorts не
// отримувало id, iframe отримував саму сторінку shorts і YouTube блокував
// її показ у фреймі (X-Frame-Options) — зовні це виглядало як "відео не
// грає".
export function extractYoutubeId(url: string): string | null {
  return (
    url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/)?.[1] ?? null
  );
}

// /file/d/ID/view, /file/d/ID/preview, open?id=ID, uc?id=ID,
// uc?export=download&id=ID — усі реальні форми, якими Google Диск видає
// посилання "Копіювати посилання" залежно від місця (Мій диск, Переглядач,
// старий "uc" формат).
export function extractDriveId(url: string): string | null {
  return (
    url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1] ??
    url.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1] ??
    null
  );
}

export function canonicalYoutubeUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

export function canonicalDriveUrl(id: string): string {
  return `https://drive.google.com/file/d/${id}/view`;
}

// youtube-nocookie — без фреймворку аналітики/кукі YouTube, доки студент
// не натиснув play (превʼю — статична картинка/градієнт, без запиту до
// youtube взагалі).
export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`;
}

export function driveEmbedUrl(id: string): string {
  return `https://drive.google.com/file/d/${id}/preview`;
}

export function youtubeThumbnailUrl(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

export function driveViewUrl(id: string): string {
  return `https://drive.google.com/file/d/${id}/view`;
}

// "upload" визначає kind за фактичним MIME файлу — надійніше за розширення
// (ім'я файлу може бути довільним).
export function mediaKindFromMime(contentType: string): PhoneticsMediaKind {
  return contentType.startsWith("video/") ? "video" : "audio";
}

const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v|ogv)(?:[?#]|$)/i;

// "url" (прямий лінк) — MIME нам не відомий, лише вигляд URL; розширення
// відео → video, усе інше (за умовчанням) → audio, той самий принцип, що
// й раніше (коли невідомо — вважати аудіо).
export function mediaKindFromUrlExtension(url: string): PhoneticsMediaKind {
  return VIDEO_EXTENSIONS.test(url) ? "video" : "audio";
}

export type MediaDetection =
  | { source: "youtube"; id: string }
  | { source: "drive"; id: string }
  | { source: "url" };

// Автовизначення джерела за вставленою адресою (конструктор) — учитель усе
// одно може перемкнути вручну після.
export function detectMediaSource(url: string): MediaDetection {
  const youtubeId = extractYoutubeId(url);
  if (youtubeId) return { source: "youtube", id: youtubeId };
  const driveId = extractDriveId(url);
  if (driveId) return { source: "drive", id: driveId };
  return { source: "url" };
}

// Санітизація/канонізація на сервері (task-config-builder.ts) — єдине
// місце правди для того, що зберігається в config. Схема — лише https
// (ніяких javascript:/data: тощо); youtube/drive завжди перебудовують
// канонічний URL із видобутого id (ігноруючи сирий текст від учителя) —
// це й гарантує, що toEmbedUrl/thumbnail пізніше завжди отримають коректний
// id, а не довільний текст.
export function normalizeMedia(raw: {
  source?: unknown;
  kind?: unknown;
  url?: unknown;
}): PhoneticsMedia | null {
  const rawUrl = typeof raw.url === "string" ? raw.url.trim() : "";
  if (!rawUrl || !isHttpsUrl(rawUrl)) return null;

  const source: PhoneticsMediaSource =
    raw.source === "upload" || raw.source === "youtube" || raw.source === "drive" || raw.source === "url"
      ? raw.source
      : "url";

  if (source === "youtube") {
    const id = extractYoutubeId(rawUrl);
    if (!id) return null;
    return { source: "youtube", kind: "video", url: canonicalYoutubeUrl(id) };
  }

  if (source === "drive") {
    const id = extractDriveId(rawUrl);
    if (!id) return null;
    const kind: PhoneticsMediaKind = raw.kind === "audio" ? "audio" : "video";
    return { source: "drive", kind, url: canonicalDriveUrl(id) };
  }

  if (source === "upload") {
    const kind: PhoneticsMediaKind = raw.kind === "video" ? "video" : "audio";
    return { source: "upload", kind, url: rawUrl };
  }

  // "url"
  const kind = mediaKindFromUrlExtension(rawUrl);
  return { source: "url", kind, url: rawUrl };
}

// Стара картка (лише audioUrl, без source/kind) — нормалізуємо при читанні
// так, як сказано явно: kind завжди "audio" (поведінка не змінюється для
// вже збережених карток без редагування), source — "upload" чи "url" не
// розрізняємо надійно за самим лише рядком URL (раніше не зберігалось),
// тож обираємо "url" (нейтральний варіант — у рендері на нього й "upload"
// не впливає інакше, обидва просто грають через наш плеєр).
export function normalizeLegacyMedia(mediaUrl: string | undefined | null): PhoneticsMedia | null {
  const url = (mediaUrl ?? "").trim();
  if (!url) return null;
  return { source: "url", kind: "audio", url };
}

export const PHONETICS_SOURCE_LABELS: Record<PhoneticsMediaSource, string> = {
  upload: "Завантажити файл",
  youtube: "YouTube",
  drive: "Google Диск",
  url: "Пряме посилання",
};
