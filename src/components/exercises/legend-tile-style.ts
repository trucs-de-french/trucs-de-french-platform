// Спільний вигляд рівних "легенда"-плиток — тонка рамка, без тіні (на
// відміну від ANSWER_CARD_BASE у answer-card-style.ts), і фіксована
// кількість колонок (grid-cols-N), а не auto-fill/minmax: остання неповна
// колонка не розтягує плитки на всю ширину рядка. Спільне для легенди
// філворду (word-search.tsx, ImageTile/TextTile/SentenceTile) і карток-
// підказок кросворду з clueStyle "long" (crossword.tsx, renderClueCard).
export const LEGEND_TILE_BASE =
  "relative rounded-lg border border-gray-200 bg-white dark:border-neutral-700 dark:bg-neutral-800";

// Колонки під текстові/змішані плитки кросворду (компактні, ширина під
// вміст) — crossword групування НЕ застосовується (ЕТАП D), ці класи там
// лишаються без змін.
export const LEGEND_TILE_GRID = "grid grid-cols-2 gap-2 md:grid-cols-3";

// Дрібніші колонки під квадратні картинкові плитки word-search ImageTile
// (ЕТАП D: картинки більші — менше колонок на вузьких/середніх екранах).
export const LEGEND_IMAGE_GRID = "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4";

// ЕТАП D — короткі текстові підказки word_search (TextTile), згруповані за
// довжиною тексту (clue-text-groups.ts) в окремі сітки S/M/L. auto-rows-fr —
// плитки в одному ряду мають однакову висоту (сама плитка розтягується
// h-full, вміст центрується всередині); порядок груп завжди S, M, L.
export const SHORT_CLUE_GRID_S = "grid auto-rows-fr grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4";
export const SHORT_CLUE_GRID_M = "grid auto-rows-fr grid-cols-2 gap-2 sm:grid-cols-3";
export const SHORT_CLUE_GRID_L = "grid auto-rows-fr grid-cols-1 gap-2 sm:grid-cols-2";

// ЕТАП D — довгі підказки-речення word_search (SentenceTile, clueMode
// "long"), згруповані за довжиною речення (clue-text-groups.ts) в окремі
// сітки short/long. auto-rows-fr — однакова висота карток у ряду; вміст
// вирівняний по верху (items-start на самій картці, не тут).
export const LONG_SENTENCE_GRID_SHORT = "grid auto-rows-fr grid-cols-1 gap-2 sm:grid-cols-2";
export const LONG_SENTENCE_GRID_LONG = "grid auto-rows-fr grid-cols-1 gap-2";
