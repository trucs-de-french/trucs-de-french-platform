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
