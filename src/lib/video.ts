export function isYouTubeUrl(url: string) {
  return /youtube\.com|youtu\.be/.test(url);
}

// Для шляхів без власного поля-провайдера в БД (task.audio_url,
// listening.config.audioUrl) — визначення gdrive лише за виглядом URL,
// той самий принцип, що isYouTubeUrl. task_groups.media_provider, де таке
// поле є, лишається джерелом правди першим, це — лише fallback.
export function isGdriveUrl(url: string) {
  return /drive\.google\.com/.test(url);
}

// Спільний для toEmbedUrl і toDirectDownloadUrl — той самий id, лише різні
// ендпоінти Google Drive для нього (/preview для iframe, uc?export=download
// для спроби прямого стріму в <audio src>).
function extractGdriveFileId(url: string): string | null {
  return url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] ?? null;
}

// Спільний з useYoutubePlayer (youtube-player.ts) — той самий id потрібен
// і для звичайного iframe-ембеду тут, і для IFrame Player API там.
export function extractYoutubeId(url: string): string | null {
  return url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/)([a-zA-Z0-9_-]{11})/)?.[1] ?? null;
}

export function toEmbedUrl(
  url: string,
  provider: "youtube" | "gdrive" | null
): string {
  if (provider === "youtube") {
    const id = extractYoutubeId(url);
    // playsinline=1 — на iOS Safari без цього параметра YouTube розгортає
    // відео в повноекранний системний плеєр просто при натисканні play.
    return id ? `https://www.youtube.com/embed/${id}?playsinline=1` : url;
  }

  if (provider === "gdrive") {
    const id = extractGdriveFileId(url);
    return id ? `https://drive.google.com/file/d/${id}/preview` : url;
  }

  return url;
}

// Пропорція обгортки відео (video-frame.tsx) для provider="gdrive" на
// ширині <640px — мобільний плеєр Google Drive сам зсуває кадр вниз і
// обрізає його, якщо тримати звичне 16/9 (показано скріншотами з
// телефону); підібрано експериментально, підкручується однією цифрою
// нижче. На ширшому екрані, і для youtube завжди — 16/9 (video-frame.css
// правила в globals.css).
export const DRIVE_MOBILE_ASPECT = 4 / 3;

// Запасний вимикач власної кнопки "На весь екран" (video-frame.tsx) САМЕ
// для provider="gdrive" на touch-пристроях (media (pointer: coarse)) —
// якщо повний екран Drive на телефонах виглядає зламано (наприклад,
// подвійне керування плеєра на Android), поставити false: кнопка зникне
// лише для цього поєднання (gdrive + touch), студент користується рідною
// кнопкою повного екрана САМОГО плеєра Drive. YouTube і десктоп — без
// змін у будь-якому разі.
export const SHOW_OWN_FULLSCREEN_BUTTON_FOR_GDRIVE_MOBILE = true;

// "poster" — на touch (media (pointer: coarse)) замість вбудованого плеєра
// Drive (video-frame.tsx) показується постер із посиланнями, що
// відкривають відео прямо в Google Drive (нова вкладка/застосунок) —
// плеєр Drive на телефонах виявився ненадійним (подвійне керування,
// обрізаний кадр, див. попередні коміти). "embed" — повернути вбудований
// плеєр як було. YouTube і десктоп не торкається в будь-якому режимі.
export const GDRIVE_TOUCH_MODE: "poster" | "embed" = "poster";

// ID файлу з embed-URL Drive (toEmbedUrl вище: https://drive.google.com/
// file/d/{ID}/preview) — НЕ те саме, що внутрішній extractGdriveFileId:
// той приймає будь-який Drive-URL (оригінальний, до toEmbedUrl), цей —
// саме вже побудований embed-URL (src, що video-frame.tsx передає й так
// рендерив в iframe), з якого постер-режим має дістати ID для посилання
// "відкрити в Drive".
export function getGdriveFileId(embedUrl: string): string | null {
  return embedUrl.match(/\/file\/d\/([^/?#]+)/)?.[1] ?? null;
}

// preview — мінімальний плеєр на всю сторінку; view — повна сторінка Drive,
// на Android може відкритись у застосунку Drive замість браузера.
export const GDRIVE_OPEN_PATH = "preview";

export function toGdriveOpenUrl(id: string): string {
  return `https://drive.google.com/file/d/${id}/${GDRIVE_OPEN_PATH}`;
}

// НЕОФІЦІЙНИЙ метод (не задокументований Google API) — надійний лише для
// файлів, що влазять у ліміт розміру антивірусної перевірки Drive; для
// більших Google повертає HTML-сторінку попередження замість байтів аудіо
// (звідси GdriveAudioPlayer з fallback на iframe, а не пряме використання
// цього URL без запобіжника). Викликач відповідає за подальшу перевірку —
// ця функція лише будує URL, не гарантує його робочість.
export function toDirectDownloadUrl(url: string): string {
  const id = extractGdriveFileId(url);
  return id ? `https://drive.google.com/uc?export=download&id=${id}` : url;
}
