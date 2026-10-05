// Спільний вигляд рівних "легенда"-плиток — тонка рамка, без тіні (на
// відміну від ANSWER_CARD_BASE у answer-card-style.ts), і фіксована
// кількість колонок (grid-cols-N), а не auto-fill/minmax: остання неповна
// колонка не розтягує плитки на всю ширину рядка. Спільне для картинкової
// плитки філворду (word-search.tsx, ImageTile) і картинкової картки-підказки
// кросворду (crossword.tsx, ImageClueCard, ЕТАП G).
export const LEGEND_TILE_BASE =
  "relative rounded-lg border border-gray-200 bg-white dark:border-neutral-700 dark:bg-neutral-800";

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

// ЕТАП H — єдиний круглий бейдж лампочки/галочки (раніше LEGEND_BULB_BADGE
// мав фіксований колір text-white і використовувався лише в LongCard/
// LongClueCard; тепер та сама форма йде і на картинки, і в пілюлі, з двома
// розмірами й спільними кольорами). Форма окремо від кольору: MD (26px,
// довгі картки й картинки) / SM (22px, пілюлі) — лише розмір; AMBER/GREEN —
// лише колір (непрозорий фон, не text-white — бейдж тепер лежить і прямо
// на фото, де напівпрозорий фон був би нечитабельним); ON_IMAGE — додаткове
// біле кільце для бейджа САМЕ над картинкою (на довгій картці з текстом
// навколо кільце не потрібне, фон картки й так контрастний).
export const LEGEND_BULB_BADGE_MD = "flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full";
export const LEGEND_BULB_BADGE_SM = "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full";
export const LEGEND_BULB_BADGE_AMBER = "bg-amber-100 text-amber-600 dark:bg-amber-900/70 dark:text-amber-300";
export const LEGEND_BULB_BADGE_GREEN = "bg-green-100 text-green-600 dark:bg-green-900/70 dark:text-green-300";
export const LEGEND_BULB_BADGE_ON_IMAGE = "shadow-sm ring-1 ring-white/70 dark:ring-white/20";

// ЕТАП H — сітка картинкових карток-підказок кросворду (ImageClueCard,
// crossword.tsx): auto-fit (не auto-fill, ЕТАП G) з вужчою колонкою
// (96-120px) — auto-fit стискає колонки, щоб рівно заповнити рядок (а не
// лишає останню колонку "про запас" як auto-fill), тож 5 карток на
// десктопі впевнено влазять в один ряд замість переносу через пару
// пікселів недостачі ширини.
export const CROSSWORD_IMAGE_GRID = "grid grid-cols-[repeat(auto-fit,minmax(6rem,7.5rem))] gap-2 justify-start";
