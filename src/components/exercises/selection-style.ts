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

// Задача "Tile rows (reorder, letters): neutral start, blue selected tile,
// live green/red after manipulation" — плитка, обрана для обміну (click-
// to-select) чи яку зараз тягнуть (drag), у SortableTileRow. НЕ той самий
// SELECTED_OPTION_CLASS (загальний блакитний, спільний для multiple_choice/
// true_false/matching/listening/reorder/drag_drop вибору варіанта) —
// навмисно окрема константа, щоб зміна вигляду ТІЛЬКИ тут (платформний
// індиго-акцент #3b36c4/#4b46da, той самий, що item-number-badge/checkbox-
// grid "checked") не чіпала вигляд вибору деінде. ring+scale (не лише
// колір рамки/фону) — вимога доступності (п.8 задачі): позначення обраної
// плитки не лише кольором. Пріоритет над LIVE_CORRECT/INCORRECT_CLASS —
// рахує викликач (sortable-tile-row.tsx tileClass): ця константа мусить
// перевірятись ПЕРШОЮ.
export const SELECTED_TILE_CLASS =
  "border-[#3b36c4] bg-indigo-50 ring-2 ring-[#3b36c4]/40 scale-[1.02] dark:border-[#8a88f5] dark:bg-[rgba(75,70,218,0.22)] dark:text-white dark:ring-[#8a88f5]/50";
