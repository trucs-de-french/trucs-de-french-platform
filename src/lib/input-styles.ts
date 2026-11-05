// Централізований базовий стиль рамки поля форми (input/textarea/select) —
// той самий принцип, що button-styles.ts. Причина існування: голий клас
// "border" (лише border-width/style, без кольору) малює рамку через
// CSS-дефолт border-color: currentColor — тобто поточним кольором ТЕКСТУ.
// Оскільки --foreground майже чорний (#1B1B2E), голі border-рамки й
// виглядали суцільно чорними. Явний border-gray-200 виправляє це раз
// назавжди, а не по одному полю.
//
// Свідомо БЕЗ padding/text-size — розміри в наявному коді відрізняються
// (px-3 py-2, px-2 py-1.5 text-sm, text-base font-medium, w-24, w-fit,
// flex-1...) і при спробі "запекти" один розмір сюди довелось би або
// плодити варіанти на кожен випадок, або ризикувати конфліктом порядку
// Tailwind-класів (dwoh однаково специфічних text-* класів в одному
// className — виграє те, що останнє в СКОМПІЛЬОВАНОМУ CSS, не в атрибуті).
// Кожне місце виклику дописує свій наявний розмір поверх цього базового
// рядка — так само, як BUTTON_* у button-styles.ts.
// pl-3 тут навмисно, а не в padding-виключенні вище — це БЕЗПЕЧний виняток:
// в Tailwind однобічні pl-*/pr-*/pt-*/pb-* у згенерованому CSS йдуть ПІСЛЯ
// двобічних px-*/py-* (звідси стандартний ідіом px-4 pl-2), тож pl-3 тут
// надійно переможе будь-який локальний px-2/px-3 лише на лівому боці, не
// займаючи правий, — на відміну від py-* (та сама "родина", що місцевий
// py-*, переможець непередбачуваний).
// Задача "Constructor: ... white input fields in all blocks" — bg-white
// додано тут явно (раніше поле просто прозоро показувало колір сторінки/
// батьківського контейнера — на звичайному білому фоні сторінки це
// виглядало ідентично, та на кольорових блоках конструктора (ConstructorBlock,
// constructor-block.tsx) прозоре поле зливалося б із тонованим фоном
// блоку): суцільний білий фон НЕЗАЛЕЖНО від фону, на якому це поле лежить.
export const INPUT_BORDER =
  "rounded-md border border-gray-200 bg-white pl-3 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";

// Той самий базовий стиль, лише жовта рамка — поле, яке task-validation.ts
// вважає незаповненим (перевірка повноти вправи в конструкторі). Той самий
// колір, що вже в амбер-попередженнях по коду (karaoke-fields.tsx тощо) —
// НЕ помилка (тому не червоний), лише незаповнене обов'язкове поле.
export const INPUT_BORDER_WARNING =
  "rounded-md border border-amber-500 bg-amber-50 pl-3 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-amber-700 dark:bg-amber-950/30 dark:text-neutral-100";

// Той самий базовий стиль, лише ЧЕРВОНА рамка — поле порушує жорсткий
// ліміт (напр. задовге слово/картка в Association, matching-limits.ts),
// не просто незаповнене: на відміну від INPUT_BORDER_WARNING (амбер,
// "незаповнено", не блокує збереження), це стан, що РЕАЛЬНО блокує
// збереження, тож колір — звичний червоний "помилка" (ті самі red-500/
// red-600, що кнопки видалення по коду), а не амбер "попередження".
export const INPUT_BORDER_ERROR =
  "rounded-md border border-red-500 bg-red-50 pl-3 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-red-700 dark:bg-red-950/30 dark:text-neutral-100";
