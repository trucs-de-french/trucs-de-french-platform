// Спільний вигляд рівних "легенда"-плиток — тонка рамка, без тіні (на
// відміну від ANSWER_CARD_BASE у answer-card-style.ts), і фіксована
// кількість колонок (grid-cols-N), а не auto-fill/minmax: остання неповна
// колонка не розтягує плитки на всю ширину рядка. Спільне для картинкової
// плитки філворду (word-search.tsx, ImageTile) і карток-підказок кросворду
// з clueStyle "long" (crossword.tsx, renderClueCard).
export const LEGEND_TILE_BASE =
  "relative rounded-lg border border-gray-200 bg-white dark:border-neutral-700 dark:bg-neutral-800";

// Колонки під текстові/змішані плитки кросворду (компактні, ширина під
// вміст) — crossword не торкались (ЕТАП D/E/F), ці класи там без змін.
export const LEGEND_TILE_GRID = "grid grid-cols-2 gap-2 md:grid-cols-3";

// Дрібніші колонки під квадратні картинкові плитки word-search ImageTile
// (ЕТАП D: картинки більші — менше колонок на вузьких/середніх екранах).
export const LEGEND_IMAGE_GRID = "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4";

// ЕТАП F, варіант C — пілюля короткої текстової підказки word_search
// (TextPill): inline-flex у спільному flex-wrap рядку (word-search.tsx),
// НЕ grid-колонка — природно розкладається по рядках незалежно від
// довжини тексту. min-h-10 — зона дотику не менша за решту кнопок вправи;
// rounded-2xl (не LEGEND_TILE_BASE rounded-lg) — більш заокруглена форма
// пілюлі, тому самостійний набір border/bg/dark-класів, а не розширення
// LEGEND_TILE_BASE (конфлікт rounded-lg/rounded-2xl при комбінуванні
// класів непередбачуваний — Tailwind-специфічність однакова, порядок у
// згенерованому CSS не збігається з порядком у рядку className).
export const LEGEND_PILL =
  "relative inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-left transition-opacity dark:border-neutral-700 dark:bg-neutral-800";

// ЕТАП F, варіант C — картка довгої підказки-речення word_search (clueMode
// "long", LongCard): на всю ширину батьківського flex-col, rounded-xl
// (окремий набір border/bg/dark-класів — та сама причина, що в LEGEND_PILL).
export const LEGEND_LONG_CARD =
  "relative flex items-start gap-2.5 rounded-xl border border-gray-200 bg-white p-3 text-left transition-opacity dark:border-neutral-700 dark:bg-neutral-800";

// ЕТАП F — кругла підкладка лампочки/галочки LongCard: 26px, форма+розмір
// спільні; колір (амбер "ще не знайдено" / зелений "знайдено") і сама
// іконка всередині — на совісті викликача (LongCard, word-search.tsx).
export const LEGEND_BULB_BADGE =
  "flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-white";
