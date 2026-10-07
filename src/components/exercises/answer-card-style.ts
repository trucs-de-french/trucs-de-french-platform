// Спільний вигляд "картка-відповідь/елемент" для студентських вправ —
// той самий стиль, що вже в картках блоків платформи (rounded-lg border
// border-gray-100 shadow-sm) і вже застосований у легенді word-search.
// Клас/фон стану (обрано/правильно/неправильно) додається окремо кожним
// викликачем — тут лише базова форма+відступ+тінь, спільна для ВСІХ станів.
export const ANSWER_CARD_BASE =
  "rounded-lg border p-3 text-center shadow-sm transition-colors";

// Стан "не обрано, ще не перевірено" — нейтральна картка з легким hover.
export const ANSWER_CARD_DEFAULT =
  "border-gray-100 bg-white hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-800/70";

// Зменшений inline-варіант — для варіантів, вплетених прямо в текст
// речення (word_choice), де повний ANSWER_CARD_BASE (p-3, rounded-lg)
// виявився занадто важким у рядку з 3-4 варіантами підряд. rounded-md (не
// rounded-lg), shadow-sm — та сама тінь, що на картках блоків платформи в
// адмінці. Шрифт тепер text-base (як усюди на студентській сторінці, було
// text-sm) — вагу компенсує ЗМЕНШЕНИЙ padding (px-1.5 py-0.5, не px-2 py-1),
// а не менший шрифт: текст лишається того самого розміру, що й решта
// сторінки, важкість регулюється лише відступом усередині картки.
// Використовується ЛИШЕ в word_choice.tsx — усі інші типи (letter_gaps,
// true_false, перша хвиля) лишаються на повному ANSWER_CARD_BASE.
export const ANSWER_CARD_INLINE = "rounded-md border px-1.5 py-0.5 shadow-sm transition-colors";

// Кругла позначка-літера (A, B, C...) — єдиний стиль для всіх трьох режимів
// chronological_order (image/mixed/text), щоб позначка виглядала однаково
// незалежно від верстки навколо неї. h-7 w-7 (28px), колір — той самий
// bg-brand/text-white, що в STUDENT_BUTTON_PRIMARY (button-styles.ts) —
// той самий акцент, не окремий відтінок. Позиціонування (absolute у
// картці-картинці, звичайний flex-item у флет-списку) лишається на
// викликачі — тут лише форма+колір+розмір.
export const ITEM_LETTER_BADGE =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-medium text-white";

// Круглий бейдж-номер питання/твердження/рядка (1, 2, 3...) — еталон:
// колишній QUESTION_NUMBER_BADGE, що жив лише в multiple-choice.tsx
// (режим dropdown/select). Винесений сюди без зміни класів, щоб той самий
// вигляд повторити в multiple_choice (картинки/чипи), word_choice,
// true_false, checkbox_grid. h-6 w-6 (24px) — менший за ITEM_LETTER_BADGE
// (28px, літерні бейджі chronological_order) — окрема семантика (номер,
// не літера), не чіпати ITEM_LETTER_BADGE.
export const ITEM_NUMBER_BADGE =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-medium text-white";

// Щільна сітка карток-з-картинкою — спочатку з'явилась у chronological_order
// (режим image/mixed): 3 колонки на мобільній, 4 на sm, 5 на md+, gap-2.
// multiple_choice (варіанти з картинкою) підключений до тих самих значень,
// щоб розмір карток в обох вправах був ідентичний. Якщо колись знадобиться
// розійтись — НЕ редагувати значення тут напряму, спершу перевірити обидва
// виклики.
export const COMPACT_IMAGE_GRID = "grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5";

// Сама картка: та форма+відступ+тінь, що й ANSWER_CARD_BASE мала намір
// дати, але щільніша (p-1.5, не p-3) — під маленьку квадратну картинку
// замість тексту на всю картку. Колір стану (ANSWER_CARD_DEFAULT і т.п.)
// додається викликачем, як і в ANSWER_CARD_BASE.
export const COMPACT_IMAGE_CARD =
  "flex flex-col items-center gap-1 rounded-lg border p-1.5 text-center shadow-sm transition-colors";

// Квадратна рамка під картинку: max-w-[6.5rem] — те саме обмеження, що і в
// chronological_order, щоб картка не розтягувалась на всю ширину колонки
// на широких екранах (grid-cols-5 лишає значно більше 6.5rem на колонку).
// overflow-hidden + дочірній img з absolute inset-0 (не h-full w-full на
// самому img без обгортки) — свідомо: відсоткова висота без inset-0 дала
// нестабільний розрахунок квадрата (див. коментар у chronological-order.tsx
// з приводу aspect-square + self-stretch).
export const COMPACT_IMAGE_FRAME =
  "relative mx-auto aspect-square w-full max-w-[6.5rem] overflow-hidden rounded-md";
export const COMPACT_IMAGE_FILL = "absolute inset-0 h-full w-full object-cover object-center";
