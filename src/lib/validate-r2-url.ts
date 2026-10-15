// Той самий принцип, що isAllowedSubtitleUrl (script-import/
// import-from-video-subtitles.ts) — перевіряємо origin, лише тут валідуємо
// (а не фетчимо) URL картинки перед записом у БД і ЗНОВУ перед рендером
// (значення з БД ніколи не довіряємо напряму, навіть власне щойно збережене:
// хтось міг редагувати рядок повз адмінку). Шлях обмежений allowlist-
// символами й розширенням — без query/fragment, бо значення підставляється
// в CSS url("...") на сторінці сцени (scene-background.tsx): лапки/дужки/
// пробіли в URL там відкрили б CSS/розмітку, regex їх просто не пропускає.
const PATH_RE = /^\/[A-Za-z0-9._-]+\.(webp|jpe?g|png|avif)$/;

export function validateR2ImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const base = process.env.R2_IMAGES_PUBLIC_URL;
  if (!base) return null;
  let parsed: URL;
  let baseOrigin: string;
  try {
    parsed = new URL(url);
    baseOrigin = new URL(base).origin;
  } catch {
    return null;
  }
  if (parsed.origin !== baseOrigin) return null;
  if (!PATH_RE.test(parsed.pathname)) return null;
  if (parsed.search || parsed.hash) return null;
  return url;
}

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export function validateHexColor(value: string | null | undefined): string | null {
  if (!value) return null;
  return HEX_COLOR_RE.test(value) ? value : null;
}
