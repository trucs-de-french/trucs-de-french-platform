// Спільний вигляд рівних "легенда"-плиток — тонка рамка, без тіні (на
// відміну від ANSWER_CARD_BASE у answer-card-style.ts), і фіксована
// кількість колонок (grid-cols-N), а не auto-fill/minmax: остання неповна
// колонка не розтягує плитки на всю ширину рядка. Спільне для легенди
// філворду (word-search.tsx, ImageTile/TextTile) і карток-підказок
// кросворду з clueStyle "long" (crossword.tsx, renderClueCard).
export const LEGEND_TILE_BASE =
  "relative rounded-lg border border-gray-200 bg-white dark:border-neutral-700 dark:bg-neutral-800";

// Колонки під текстові/змішані плитки (компактні, ширина під вміст).
export const LEGEND_TILE_GRID = "grid grid-cols-2 gap-2 md:grid-cols-3";

// Дрібніші колонки під квадратні картинкові плитки (word-search ImageTile).
export const LEGEND_IMAGE_GRID = "grid grid-cols-4 gap-2 md:grid-cols-6";
