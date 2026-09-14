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
export const INPUT_BORDER =
  "rounded-md border border-gray-200 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";
