// Точка фокусу кадрування (object-cover) кодується прямо у фрагменті самого
// URL картинки — `<url>#focus=X,Y` (X, Y — цілі відсотки 0-100) — а не
// окремим полем поруч, щоб фокус завжди подорожував разом з посиланням
// (копіювання/дублювання картинки з одного поля в інше не губить фокус).
// Інші можливі частини фрагмента (наразі не використовуються, але формат
// лишає місце) зберігаються при записі — join("&") без URLSearchParams,
// щоб уникнути percent-encoding коми у "X,Y".
export type ParsedImageFocus = { src: string; x: number; y: number };

const DEFAULT_FOCUS = { x: 50, y: 50 };

function splitFragment(url: string): { src: string; params: string[] } {
  const hashIndex = url.indexOf("#");
  if (hashIndex === -1) return { src: url, params: [] };
  return {
    src: url.slice(0, hashIndex),
    params: url.slice(hashIndex + 1).split("&").filter(Boolean),
  };
}

function clampPercent(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

// src — URL БЕЗ фрагмента focus (готовий для <img src>), x/y — 50/50 за
// замовчуванням, якщо фрагмент відсутній або невалідний.
export function parseImageFocus(url: string): ParsedImageFocus {
  if (!url) return { src: url, ...DEFAULT_FOCUS };
  const { src, params } = splitFragment(url);
  const focusParam = params.find((p) => p.startsWith("focus="));
  if (!focusParam) return { src, ...DEFAULT_FOCUS };
  const [xRaw, yRaw] = focusParam.slice("focus=".length).split(",");
  const x = Number(xRaw);
  const y = Number(yRaw);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { src, ...DEFAULT_FOCUS };
  return { src, x: clampPercent(x), y: clampPercent(y) };
}

// Повертає url з оновленим (доданим/заміненим) focus=X,Y у фрагменті —
// решта фрагмента (якщо колись з'явиться) лишається як є. Фокус 50/50 —
// це "без кадрування" (дефолт), тож focus-параметр прибирається цілком; якщо
// після цього фрагмент порожній, прибирається і сам "#".
export function withImageFocus(url: string, x: number, y: number): string {
  if (!url) return url;
  const { src, params } = splitFragment(url);
  const rest = params.filter((p) => !p.startsWith("focus="));
  const cx = clampPercent(x);
  const cy = clampPercent(y);
  const next = cx === DEFAULT_FOCUS.x && cy === DEFAULT_FOCUS.y ? rest : [...rest, `focus=${cx},${cy}`];
  return next.length > 0 ? `${src}#${next.join("&")}` : src;
}
