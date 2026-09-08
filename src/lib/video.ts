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

export function toEmbedUrl(
  url: string,
  provider: "youtube" | "gdrive" | null
): string {
  if (provider === "youtube") {
    const id = url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/)([a-zA-Z0-9_-]{11})/)?.[1];
    return id ? `https://www.youtube.com/embed/${id}` : url;
  }

  if (provider === "gdrive") {
    const id = url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1];
    return id ? `https://drive.google.com/file/d/${id}/preview` : url;
  }

  return url;
}
