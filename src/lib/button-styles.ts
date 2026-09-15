// Централізовані ролі кнопок — прості рядки класів (не React-компонент),
// щоб підставлятись напряму в className= будь-де: SubmitButton, ConfirmForm,
// <Link>, <button> — усі різні елементи, спільний компонент довелось би
// обгортати навколо кожного окремо. Мета — щоб наступна зміна кольору ролі
// (як два попередні відкати indigo/violet цієї сесії) була правкою в ОДНОМУ
// файлі, а не в 20+.
//
// Розмір (px-3 py-1.5 text-sm) — найпоширеніший наявний; _SM — компактний
// варіант (px-2 py-1 text-xs) для щільних місць (рядки drag-list, inline
// дії в списках) — розмір той самий, що вже там був, міняється лише роль.
export const BUTTON_PRIMARY =
  "rounded-md bg-brand px-3 py-1.5 text-sm text-white hover:bg-brand-hover disabled:opacity-50";
export const BUTTON_PRIMARY_SM =
  "rounded bg-brand px-2 py-1 text-xs text-white hover:bg-brand-hover disabled:opacity-50";
// Самостійна CTA-кнопка на сторінці (не в ряду поряд з іншими діями) —
// "Зберегти" (SaveForm), "+ Новий курс" тощо — той самий, трохи більший
// розмір, що вже був у цих конкретних місцях до централізації.
export const BUTTON_PRIMARY_LG =
  "rounded-md bg-brand px-4 py-2 text-sm text-white hover:bg-brand-hover disabled:opacity-50";

export const BUTTON_SECONDARY =
  "rounded-md border border-brand px-3 py-1.5 text-sm text-brand hover:bg-brand/10 disabled:opacity-50";
export const BUTTON_SECONDARY_SM =
  "rounded border border-brand px-2 py-1 text-xs text-brand hover:bg-brand/10 disabled:opacity-50";
// Той самий розмір, що BUTTON_PRIMARY_LG (px-4 py-2) — для випадків, коли
// самостійна CTA-кнопка (SaveForm тощо) має стати другорядною ПОРЯД із
// важливішою залитою дією десь-інде на сторінці (напр. окремі "Зберегти"
// в блоках сцени проти закріпленої "Зберегти все"), без зміни розміру.
export const BUTTON_SECONDARY_LG =
  "rounded-md border border-brand px-4 py-2 text-sm text-brand hover:bg-brand/10 disabled:opacity-50";

// Реверсивна попереджувальна дія (зняти з публікації, архівувати) —
// амбер, не червоний: сигналізує "обережно", не "незворотно", на відміну
// від BUTTON_DANGER.
export const BUTTON_WARNING =
  "rounded-md border border-amber-300 px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/50 disabled:opacity-50";
export const BUTTON_WARNING_SM =
  "rounded border border-amber-300 px-2 py-1 text-xs text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/50 disabled:opacity-50";

// Перегляд очима студента ("Переглянути як студент"/"Переглянути в режимі
// учня") — окрема роль, не BUTTON_SECONDARY: indigo конфліктував з
// сусідніми amber-кнопками (Зняти з публікації/Архівувати). Контурна (не
// залита) — білий фон, cyan-рамка/текст, легка cyan-заливка на hover —
// той самий "outline"-патерн, що BUTTON_SECONDARY/WARNING/DANGER, просто
// іншим кольором, щоб не зливатись і не виглядати важчою за сусідні дії.
export const BUTTON_PREVIEW =
  "rounded-md border border-cyan-500 bg-white px-3 py-1.5 text-sm text-cyan-600 hover:border-cyan-600 hover:bg-cyan-50 hover:text-cyan-700 dark:border-cyan-700 dark:bg-neutral-900 dark:text-cyan-400 dark:hover:border-cyan-600 dark:hover:bg-cyan-950/50 dark:hover:text-cyan-300 disabled:opacity-50";

// Незворотна дія (видалити назавжди).
export const BUTTON_DANGER =
  "rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50 disabled:opacity-50";
export const BUTTON_DANGER_SM =
  "rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50 disabled:opacity-50";
