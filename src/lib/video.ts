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

export function toEmbedUrl(
  url: string,
  provider: "youtube" | "gdrive" | null
): string {
  if (provider === "youtube") {
    const id = url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/)([a-zA-Z0-9_-]{11})/)?.[1];
    return id ? `https://www.youtube.com/embed/${id}` : url;
  }

  if (provider === "gdrive") {
    const id = extractGdriveFileId(url);
    return id ? `https://drive.google.com/file/d/${id}/preview` : url;
  }

  return url;
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
