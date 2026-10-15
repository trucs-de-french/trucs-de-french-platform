// Похідні кольори категорій вокабуляру — винесено з vocab-section.tsx
// (студентська таблиця), щоб vocab-pdf.ts міг використати ТОЧНО ту саму
// палітру/логіку контрасту, а не копіювати її вдруге. Сам набір базових
// кольорів і далі лише в PART_OF_SPEECH_COLORS (vocab-categories.ts) —
// тут немає жодного нового кольору категорії, лише похідні відтінки.

// rgb01 — [r,g,b] 0..1 на канал (той самий формат, що PART_OF_SPEECH_COLORS,
// pdf-lib теж читає кольори саме в цьому форматі). rgb255 — те саме, 0..255,
// для CSS (hex/rgba) на студентській сторінці.
export type Rgb01 = [number, number, number];
export type Rgb255 = [number, number, number];

export function toRgb255(rgb: Rgb01): Rgb255 {
  return [Math.round(rgb[0] * 255), Math.round(rgb[1] * 255), Math.round(rgb[2] * 255)];
}

export function rgbToHex([r, g, b]: Rgb255): string {
  const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// WCAG relative luminance — той самий підхід, що scene-background-mode.ts
// (окремий, невеликий дублікат: той файл не експортує цю функцію).
export function relativeLuminance([r, g, b]: Rgb255): number {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Темнішає колір категорії (крок -18% яскравості на канал, до 6 кроків),
// поки контраст із білим не досягне 4.5:1 — для надто світлих категорій
// (adjectif/зелений і т.п.) даємо темнішу пігулку/текст замість того, щоб
// міняти колір тексту (простіший варіант, узгоджений для студентської
// таблиці — та сама логіка тут, для PDF).
export function darkenUntilContrast(rgb: Rgb255, minRatio: number): Rgb255 {
  let current = rgb;
  for (let i = 0; i < 6; i++) {
    if (contrastRatio(relativeLuminance(current), 1) >= minRatio) break;
    current = current.map((c) => c * 0.82) as Rgb255;
  }
  return current;
}

export type CategoryPalette = {
  /** [r,g,b] 0..255 — сам колір категорії (без затемнення). */
  rgb255: Rgb255;
  /** rgb "r, g, b" рядок для CSS rgba()/--cat-rgb. */
  rgbTriplet: string;
  /** Пігулка заголовка — колір категорії, темніший за потреби для білого тексту. */
  pillRgb255: Rgb255;
  pillHex: string;
  /** Темніший відтінок для лічильника слів і тексту чипа легенди (читабельний на майже білому). */
  textRgb255: Rgb255;
  textHex: string;
};

export function categoryPalette(rgb01: Rgb01): CategoryPalette {
  const base = toRgb255(rgb01);
  const pill = contrastRatio(relativeLuminance(base), 1) >= 4.5 ? base : darkenUntilContrast(base, 4.5);
  const text = darkenUntilContrast(base, 4.5);
  return {
    rgb255: base,
    rgbTriplet: `${base[0]}, ${base[1]}, ${base[2]}`,
    pillRgb255: pill,
    pillHex: rgbToHex(pill),
    textRgb255: text,
    textHex: rgbToHex(text),
  };
}
