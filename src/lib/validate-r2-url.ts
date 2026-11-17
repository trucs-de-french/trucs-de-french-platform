// Той самий принцип, що isAllowedSubtitleUrl (script-import/
// import-from-video-subtitles.ts) — перевіряємо origin, лише тут валідуємо
// (а не фетчимо) URL картинки перед записом у БД і ЗНОВУ перед рендером
// (значення з БД ніколи не довіряємо напряму, навіть власне щойно збережене:
// хтось міг редагувати рядок повз адмінку). Шлях обмежений allowlist-
// символами й розширенням — без query/fragment, бо значення підставляється
// в CSS url("...") на сторінці сцени (scene-background.tsx): лапки/дужки/
// пробіли в URL там відкрили б CSS/розмітку, regex їх просто не пропускає.
const PATH_RE = /^\/[A-Za-z0-9._-]+\.(webp|jpe?g|png|avif)$/;

// Задача-виправлення "use custom R2 domains for media, images and games":
// publicUrl-env тепер вказує на images.trucsdefrench.com (новий custom
// domain), але старі рядки в БД (до міграції даних) усе ще посилаються на
// тимчасовий pub-<hex>.r2.dev — без цього вони провалювали б перевірку
// origin і зображення просто зникли б. pub-<hex>.r2.dev — ФІКСОВАНИЙ
// формат публічного r2.dev-хоста Cloudflare (не довільний рядок), тож
// допускати його тут безпечно; прибрати цю гілку можна, коли учителька
// підтвердить, що старих r2.dev-хостів у БД більше нема (Cloudflare
// планує вимкнути ці r2.dev-хости).
const LEGACY_R2_DEV_HOST_RE = /^pub-[0-9a-f]+\.r2\.dev$/i;

export function isLegacyR2DevHost(hostname: string): boolean {
  return LEGACY_R2_DEV_HOST_RE.test(hostname);
}

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
  const isCurrentHost = parsed.origin === baseOrigin;
  const isLegacyHost = parsed.protocol === "https:" && isLegacyR2DevHost(parsed.hostname);
  if (!isCurrentHost && !isLegacyHost) return null;
  if (!PATH_RE.test(parsed.pathname)) return null;
  if (parsed.search || parsed.hash) return null;
  return url;
}

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export function validateHexColor(value: string | null | undefined): string | null {
  if (!value) return null;
  return HEX_COLOR_RE.test(value) ? value : null;
}
