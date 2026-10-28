// Спільний вигляд "цей варіант зараз обрано" (до натискання "Перевірити") —
// одна точка правди для multiple_choice/true_false/matching/listening/
// reorder/drag_drop, щоб виділення виглядало однаково всюди.
export const SELECTED_OPTION_CLASS =
  "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40";

// Живе підсвічування "правильно/неправильно" для полів і плиток із рамкою
// (letter_gaps-поля, SortableTileRow-плитки letter_rearrangement/reorder)
// — раніше однаковий рядок був дослівно продубльований у letter-gaps.tsx
// (пост-перевірка) і sortable-tile-row.tsx, тепер одна точка правди. НЕ
// використовується в crossword.tsx — там інша форма віджета (літера в
// клітинці таблиці без власної рамки, підсвічування через bg+text-колір
// клітинки, не border+bg плитки/поля), тож інший, вже усталений набір
// класів свій для тієї форми.
// Темна тема — var(--dark-surface-fill) + повносилова рамка (--correct-
// border-dark/--wrong-border-dark, та самі токени, що .exercise-field--
// correct/--wrong) замість тьмяної зелено/червоної заливки й успадкованого
// приглушеного кольору букви; disabled:opacity-100 перекриває базовий
// disabled:opacity-70 кнопки для заблокованої (після перевірки) плитки —
// саме він "гасив" літеру до сірого.
export const LIVE_CORRECT_CLASS =
  "border-green-500 bg-green-50 dark:border-[var(--correct-border-dark)] dark:bg-[var(--dark-surface-fill)] dark:text-[var(--field-ink)] dark:disabled:opacity-100";
export const LIVE_INCORRECT_CLASS =
  "border-red-500 bg-red-50 dark:border-[var(--wrong-border-dark)] dark:bg-[var(--dark-surface-fill)] dark:text-[var(--field-ink)] dark:disabled:opacity-100";
