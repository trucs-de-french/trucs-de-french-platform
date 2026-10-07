// Вибір розкладки для checkbox_grid: звичайна таблиця (твердження в рядках,
// варіанти в шапці) чи транспонована matrix (твердження списком зверху,
// таблиця з номерами тверджень у шапці й варіантами в рядках). Чиста
// функція — БЕЗ залежності від реальної ширини екрана в JS (лише "mobile"/
// "desktop" як параметр), щоб SSR і клієнт завжди дали однаковий результат
// і не було розбіжності гідратації.
export type LayoutScreen = "mobile" | "desktop";
export type GridLayout = "table" | "matrix";

type LayoutLimits = {
  statementMaxChars: number;
  optionMaxChars: number;
  maxOptions: number;
};

// Два набори лімітів, на старті однакові. Набір desktop можна підняти
// окремо (більші числа), якщо на комп'ютері довші твердження/варіанти
// мають лишатись у звичайній таблиці — мобільний набір піднімати нема
// куди, там завжди вузько.
export const LAYOUT_LIMITS: Record<LayoutScreen, LayoutLimits> = {
  mobile: { statementMaxChars: 28, optionMaxChars: 16, maxOptions: 4 },
  desktop: { statementMaxChars: 28, optionMaxChars: 16, maxOptions: 4 },
};

function textLength(s: string): number {
  return s.trim().length;
}

export function pickLayout(
  statementLabels: string[],
  optionLabels: string[],
  screen: LayoutScreen,
): GridLayout {
  // Єдине твердження — завжди звичайна таблиця, транспонувати нема сенсу.
  if (statementLabels.length <= 1) return "table";

  const limits = LAYOUT_LIMITS[screen];
  const maxStatement = Math.max(0, ...statementLabels.map(textLength));
  const maxOption = Math.max(0, ...optionLabels.map(textLength));

  const fitsTable =
    maxStatement <= limits.statementMaxChars &&
    maxOption <= limits.optionMaxChars &&
    optionLabels.length <= limits.maxOptions;

  return fitsTable ? "table" : "matrix";
}
