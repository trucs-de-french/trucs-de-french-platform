// Спільний вигляд рівних "легенда"-плиток — тонка рамка, без тіні (на
// відміну від ANSWER_CARD_BASE у answer-card-style.ts), і фіксована
// кількість колонок (grid-cols-N), а не auto-fill/minmax: остання неповна
// колонка не розтягує плитки на всю ширину рядка. Спільне для картинкової
// плитки філворду (word-search.tsx, ImageTile) і картинкової картки-підказки
// кросворду (crossword.tsx, ImageClueCard, ЕТАП G).
export const LEGEND_TILE_BASE =
  "relative rounded-[14px] dark:rounded-lg border-[1.5px] dark:border glass-chip border-[#dcbd6e] bg-white glass-gap-shadow dark:shadow-none dark:border-[var(--card-border)] dark:bg-[var(--card-bg)]";

// Та сама форма (радіус/фон/тінь), але БЕЗ кольору рамки — для крос-
// ворду (crossword.tsx), де рамка має РЕАЛЬНО чергуватись (ідле-чип/
// правильно/активне) як ВЗАЄМОВИКЛЮЧНІ варіанти в одному className, а не
// накладатись на LEGEND_TILE_BASE: раніше .glass-chip (і до нього
// .glass-gold-edge) там завжди лишався ПОРЯД зі border-green-500/border-
// blue-400 в одному рядку класів, і через вищу специфічність світлового
// CSS-класу колір стану не бачився. word-search.tsx (ImageTile) і далі
// бере LEGEND_TILE_BASE як є — там немає кольорового стану, що
// конфліктував би.
// Мокап "варіант 2" — темна тема картки-підказки кросворду тепер на
// токенах .glass-item-card (rgba(255,255,255,.06) / rgba(243,217,139,.25)),
// НЕ на neutral-700/800: LEGEND_TILE_SHAPE лишається виключним для
// crossword.tsx (word-search.tsx бере LEGEND_TILE_BASE вище, не цю
// константу), тож зміна тут не чіпає філворд.
export const LEGEND_TILE_SHAPE =
  "relative rounded-[14px] dark:rounded-lg border-[1.5px] dark:border bg-white glass-gap-shadow dark:shadow-none dark:border-[rgba(243,217,139,0.25)] dark:bg-white/[0.06]";

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
  "relative inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-2xl border-[1.5px] dark:border glass-chip border-[#dcbd6e] bg-white glass-gap-shadow dark:shadow-none px-3 py-2 text-left transition-opacity dark:border-[var(--card-border)] dark:bg-[var(--card-bg)]";

// Та сама форма без кольору рамки, для крос-ворду — та сама причина, що
// LEGEND_TILE_SHAPE вище.
export const LEGEND_PILL_SHAPE =
  "relative inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-2xl border-[1.5px] dark:border bg-white glass-gap-shadow dark:shadow-none px-3 py-2 text-left transition-opacity dark:border-neutral-700 dark:bg-neutral-800";

// ЕТАП F, варіант C — картка довгої підказки-речення word_search (clueMode
// "long", LongCard): на всю ширину батьківського flex-col, rounded-xl
// (окремий набір border/bg/dark-класів — та сама причина, що в LEGEND_PILL).
export const LEGEND_LONG_CARD =
  "relative flex items-start gap-2.5 rounded-[14px] dark:rounded-xl border-[1.5px] dark:border glass-chip border-[#dcbd6e] bg-white glass-gap-shadow dark:shadow-none p-3 text-left transition-opacity dark:border-[var(--card-border)] dark:bg-[var(--card-bg)]";

// Та сама форма без кольору рамки, для крос-ворду — та сама причина, що
// LEGEND_TILE_SHAPE вище. Темна тема — токени .glass-item-card
// (rgba(255,255,255,.06) / rgba(243,217,139,.25)), не neutral-700/800:
// LEGEND_LONG_CARD_SHAPE лишається виключним для crossword.tsx (word-
// search.tsx бере LEGEND_LONG_CARD вище, не цю константу).
export const LEGEND_LONG_CARD_SHAPE =
  "relative flex items-start gap-2.5 rounded-[14px] dark:rounded-xl border-[1.5px] dark:border bg-white glass-gap-shadow dark:shadow-none p-3 text-left transition-opacity dark:border-[rgba(243,217,139,0.25)] dark:bg-white/[0.06]";

// ОДНА лампочка-підказка в усій студентській частині (раніше кожен тип
// вправи мав свій розмір/варіант — LEGEND_BULB_BADGE_MD/SM (26/22px, плоский
// амбер), окремий 28px "goldCircle" заголовка кросворду, 18px декоративний
// варіант у чипі word_choice): усі замінені на ЦЕЙ один золотий гурток
// (hint-bulb.tsx бере лише ці константи). ON_IMAGE — додаткове біле кільце
// для лампочки САМЕ над картинкою (word-search.tsx ImageTile), де фон не
// контрастний сам по собі.
export const GOLD_CIRCLE_ON_IMAGE = "shadow-sm ring-1 ring-white/70 dark:ring-white/20";

export const GOLD_CIRCLE_SIZE = "flex h-7 w-7 shrink-0 items-center justify-center rounded-full";
// Зона дотику ≥40×40 — padding 6px навколо видимого 28px (h-7 w-7) гуртка
// замість збільшення самого гуртка (видима форма лишається 28px, як у
// мокапі): 28 + 6*2 = 40.
export const GOLD_CIRCLE_HIT_AREA_PADDING = "p-[6px]";
export const GOLD_CIRCLE_AVAILABLE =
  "bg-gradient-to-b from-[#f6dc8e] to-[#e0aa3e] text-[#6b4a14] shadow-[0_3px_8px_rgba(184,144,47,0.45)]";
export const GOLD_CIRCLE_DONE = "bg-green-100 text-green-600 dark:bg-green-900/70 dark:text-green-300";

// ЕТАП H — сітка картинкових карток-підказок кросворду (ImageClueCard,
// crossword.tsx): auto-fit (не auto-fill, ЕТАП G) з вужчою колонкою
// (96-120px) — auto-fit стискає колонки, щоб рівно заповнити рядок (а не
// лишає останню колонку "про запас" як auto-fill), тож 5 карток на
// десктопі впевнено влазять в один ряд замість переносу через пару
// пікселів недостачі ширини.
// gap-3.5 (14px) — мокап "варіант 2", п.3, "14px gap between cards".
export const CROSSWORD_IMAGE_GRID = "grid grid-cols-[repeat(auto-fit,minmax(6rem,7.5rem))] gap-3.5 justify-start";
