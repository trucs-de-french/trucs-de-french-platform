// Спільний вигляд "картка-відповідь/елемент" для студентських вправ —
// той самий стиль, що вже в картках блоків платформи (rounded-lg border
// border-gray-100 shadow-sm) і вже застосований у легенді word-search.
// Клас/фон стану (обрано/правильно/неправильно) додається окремо кожним
// викликачем — тут лише базова форма+відступ+тінь, спільна для ВСІХ станів.
export const ANSWER_CARD_BASE =
  "rounded-[14px] border-[1.5px] p-3 text-center glass-card-shadow dark:shadow-none transition-colors";

// Стан "не обрано, ще не перевірено" — нейтральна картка з легким hover.
// ЛИШЕ для flip_cards (великі картки-грані, лишаються на градієнтній
// рамці+великій тіні variant 4/3238d64) — усі інші типи (matching/
// listening/multiple_choice/vocab_quiz/sort_columns/chronological_order/
// image_match), де ця константа раніше теж бралась, перейшли на менші
// ANSWER_CHIP_BASE/ANSWER_CHIP_DEFAULT нижче (суцільна рамка-чип, як у
// полів-пропусків, без градієнта й без великої тіні).
export const ANSWER_CARD_DEFAULT =
  "glass-gold-edge glass-card-hover bg-white hover:bg-neutral-50 dark:border-[var(--card-border)] dark:bg-[var(--dark-surface-fill)] dark:hover:bg-[var(--card-hover-bg)] dark:hover:border-[var(--card-hover-border)]";

// Той самий розмір/відступ/радіус, що ANSWER_CARD_BASE/DEFAULT, але
// маленька рамка-чип (border rgba(217,183,101,.55) 1px, легка тінь
// .glass-gap-shadow, hover лише трохи темнішою рамкою) замість
// градієнтної рамки+великої тіні картки — для "дрібних" інтерактивних
// елементів (варіанти відповіді matching/listening/multiple_choice/
// vocab_quiz/sort_columns/chronological_order/image_match), не великих
// карток. Колір стану (вибрано/правильно/неправильно) додається
// викликачем окремо, як і в ANSWER_CARD_BASE/DEFAULT.
export const ANSWER_CHIP_BASE =
  "rounded-[14px] dark:rounded-lg border-[1.5px] dark:border p-3 text-center glass-gap-shadow dark:shadow-sm transition-colors";
export const ANSWER_CHIP_DEFAULT =
  "glass-chip glass-chip-hover bg-white hover:bg-neutral-50 dark:border-[var(--card-border)] dark:bg-[var(--card-bg)] dark:hover:bg-[var(--card-hover-bg)] dark:hover:border-[var(--card-hover-border)]";

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
export const ANSWER_CARD_INLINE =
  "rounded-md border px-1.5 py-0.5 glass-card-shadow dark:shadow-sm transition-colors";

// Картка-обгортка питання/елемента з рамкою (спершу multiple_choice,
// тепер і word_choice — для візуальної цілісності сцени, кожне речення в
// такій самій картці, що й питання multiple_choice): overflow-hidden
// rounded-xl border з ЯВНИМ токеном кольору (не currentColor, баг
// Tailwind v4, 0b80d3a). Клас перенесено сюди з колишнього локального
// CARD_WRAP у multiple-choice.tsx БЕЗ зміни значення — рядок той самий,
// multiple_choice імпортує звідси під тим самим локальним ім'ям.
export const ITEM_CARD_WRAP =
  "overflow-hidden rounded-[14px] dark:rounded-xl border-[1.5px] dark:border-[1.5px] glass-gold-edge glass-card-shadow bg-white dark:border-[var(--card-border)] dark:bg-[var(--card-bg)]";

// Круглий бейдж-номер питання/твердження/рядка (1, 2, 3...) — еталон:
// колишній QUESTION_NUMBER_BADGE, що жив лише в multiple-choice.tsx
// (режим dropdown/select). Винесений сюди без зміни класів, щоб той самий
// вигляд повторити в multiple_choice (картинки/чипи), word_choice,
// true_false, checkbox_grid.
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
  "chrono-image-card flex flex-col items-center gap-1 rounded-[14px] dark:rounded-lg border-[1.5px] dark:border p-1.5 text-center glass-gap-shadow dark:shadow-sm transition-colors";

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

// Підкладка-пул з плитками-відповідями під карткою питання (multiple_choice,
// тепер і listening через ChoiceQuestionCard) — один стовпець на мобільній,
// на sm+ стільки колонок auto-fit влізе (мінімум 11rem на плитку). Рядок
// перенесено сюди з колишнього локального POOL_CLASS у multiple-choice.tsx
// БЕЗ зміни значення, щоб listening.tsx міг узяти той самий клас, а не
// передруковувати його.
export const POOL_CLASS =
  "grid grid-cols-1 items-stretch gap-2 border-t border-[#e6e6f0] glass-inset-bg bg-neutral-50 p-2.5 dark:border-[var(--card-border)] pool-dark-bg sm:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]";

// Плитка-відповідь у пулі: min-h-12 (48px) — зона дотику на touch. Колір
// стану додається викликачем окремо (chipClass/tileClass і т.п.) — перенесено
// з колишнього локального TILE_BASE у multiple-choice.tsx без зміни значення.
export const TILE_BASE =
  "flex min-h-12 items-center gap-2 rounded-lg border glass-gap-shadow px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";
