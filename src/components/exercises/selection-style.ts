// Спільний вигляд "цей варіант зараз обрано" (до натискання "Перевірити") —
// одна точка правди для multiple_choice/true_false/matching/listening/
// reorder/drag_drop, щоб виділення виглядало однаково всюди.
export const SELECTED_OPTION_CLASS =
  "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40";

// Живе підсвічування "правильно/неправильно" для полів і плиток із рамкою
// (letter_gaps-поля, SwappableTileRow-плитки letter_rearrangement/reorder)
// — раніше однаковий рядок був дослівно продубльований у letter-gaps.tsx
// (пост-перевірка) і swappable-tile-row.tsx, тепер одна точка правди. НЕ
// використовується в crossword.tsx — там інша форма віджета (літера в
// клітинці таблиці без власної рамки, підсвічування через bg+text-колір
// клітинки, не border+bg плитки/поля), тож інший, вже усталений набір
// класів свій для тієї форми.
export const LIVE_CORRECT_CLASS = "border-green-500 bg-green-50 dark:bg-green-950/30";
export const LIVE_INCORRECT_CLASS = "border-red-500 bg-red-50 dark:bg-red-950/30";
