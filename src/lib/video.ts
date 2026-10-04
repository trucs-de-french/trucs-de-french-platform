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
