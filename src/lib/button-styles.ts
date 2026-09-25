// Централізовані ролі кнопок — прості рядки класів (не React-компонент),
// щоб підставлятись напряму в className= будь-де: SubmitButton, ConfirmForm,
// <Link>, <button> — усі різні елементи, спільний компонент довелось би
// обгортати навколо кожного окремо. Мета — щоб наступна зміна кольору ролі
// (як два попередні відкати indigo/violet цієї сесії) була правкою в ОДНОМУ
// файлі, а не в 20+.
//
// font-heading (Nunito) прописаний прямо в кожній константі — глобальне
// CSS-правило "button {...}" (globals.css) саме по собі НЕ покриває ролі,
// застосовані до <a>/<Link> (STUDENT_LINK_BUTTON тощо, як і пояснено вище
// — не всі ці ролі сидять на справжньому <button>), тож без явного класу
// тут такі посилання-кнопки лишились би на Lora (body).
//
// Розмір (px-3 py-1.5 text-sm) — найпоширеніший наявний; _SM — компактний
// варіант (px-2 py-1 text-xs) для щільних місць (рядки drag-list, inline
// дії в списках) — розмір той самий, що вже там був, міняється лише роль.
export const BUTTON_PRIMARY =
  "font-heading rounded-md bg-brand px-3 py-1.5 text-sm text-white hover:bg-brand-hover disabled:opacity-50";
export const BUTTON_PRIMARY_SM =
  "font-heading rounded bg-brand px-2 py-1 text-xs text-white hover:bg-brand-hover disabled:opacity-50";
// Самостійна CTA-кнопка на сторінці (не в ряду поряд з іншими діями) —
// "Зберегти" (SaveForm), "+ Новий курс" тощо — той самий, трохи більший
// розмір, що вже був у цих конкретних місцях до централізації.
export const BUTTON_PRIMARY_LG =
  "font-heading rounded-md bg-brand px-4 py-2 text-sm text-white hover:bg-brand-hover disabled:opacity-50";

export const BUTTON_SECONDARY =
  "font-heading rounded-md border border-brand px-3 py-1.5 text-sm text-brand hover:bg-brand/10 disabled:opacity-50";
export const BUTTON_SECONDARY_SM =
  "font-heading rounded border border-brand px-2 py-1 text-xs text-brand hover:bg-brand/10 disabled:opacity-50";
// Той самий розмір, що BUTTON_PRIMARY_LG (px-4 py-2) — для випадків, коли
// самостійна CTA-кнопка (SaveForm тощо) має стати другорядною ПОРЯД із
// важливішою залитою дією десь-інде на сторінці (напр. окремі "Зберегти"
// в блоках сцени проти закріпленої "Зберегти все"), без зміни розміру.
export const BUTTON_SECONDARY_LG =
  "font-heading rounded-md border border-brand px-4 py-2 text-sm text-brand hover:bg-brand/10 disabled:opacity-50";

// Реверсивна попереджувальна дія (зняти з публікації, архівувати) —
// амбер, не червоний: сигналізує "обережно", не "незворотно", на відміну
// від BUTTON_DANGER.
export const BUTTON_WARNING =
  "font-heading rounded-md border border-amber-300 px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/50 disabled:opacity-50";
export const BUTTON_WARNING_SM =
  "font-heading rounded border border-amber-300 px-2 py-1 text-xs text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/50 disabled:opacity-50";

// Перегляд очима студента ("Переглянути як студент"/"Переглянути в режимі
// учня") — окрема роль, не BUTTON_SECONDARY: indigo конфліктував з
// сусідніми amber-кнопками (Зняти з публікації/Архівувати). Контурна (не
// залита) — білий фон, cyan-рамка/текст, легка cyan-заливка на hover —
// той самий "outline"-патерн, що BUTTON_SECONDARY/WARNING/DANGER, просто
// іншим кольором, щоб не зливатись і не виглядати важчою за сусідні дії.
export const BUTTON_PREVIEW =
  "font-heading rounded-md border border-cyan-500 bg-white px-3 py-1.5 text-sm text-cyan-600 hover:border-cyan-600 hover:bg-cyan-50 hover:text-cyan-700 dark:border-cyan-700 dark:bg-neutral-900 dark:text-cyan-400 dark:hover:border-cyan-600 dark:hover:bg-cyan-950/50 dark:hover:text-cyan-300 disabled:opacity-50";

// Студентська сторінка (вправи) — основна дія на картці вправи
// ("Перевірити", "Випадковий вибір" у flip_cards тощо). Тінь (shadow-sm),
// font-medium і трохи більший розмір (px-4 py-2) — навмисно інші від
// BUTTON_PRIMARY/_LG вище: студентська CTA сприймається як самостійна дія
// під карткою вправи, не рядок компактних адмін-дій.
export const STUDENT_BUTTON_PRIMARY =
  "font-heading rounded-md bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand/90 disabled:opacity-50";

// Другорядна кнопка-перемикач студентської сторінки (швидкість відтворення
// аудіо тощо) — ДВА стани, не один: неактивний — нейтральна картка
// (bg-white/border-gray-200/shadow-sm, той самий принцип, що
// ANSWER_CARD_DEFAULT в exercises/answer-card-style.ts), обраний —
// залитий brand. НЕ те саме, що BUTTON_SECONDARY вище (контурна brand-рамка
// на прозорому фоні для адмінських другорядних дій) — тут неактивний стан
// навмисно сіро-нейтральний, щоб не читався як CTA серед рядка однакових
// перемикачів.
export const STUDENT_BUTTON_SECONDARY_IDLE =
  "font-heading rounded border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800/70";
export const STUDENT_BUTTON_SECONDARY_ACTIVE =
  "font-heading rounded border border-brand bg-brand px-2 py-0.5 text-xs font-medium text-white shadow-sm transition-colors";

// Кнопка-посилання "Практики"/додаткових блоків посилань (scene_links,
// студентська сторінка сцени) — той самий розмір (rounded-md px-3 py-1.5
// text-sm), що вже був, тепер із брендовою рамкою й легкою тінню замість
// плоскої сірої. dark:hover — neutral-700, НЕ neutral-800: сам контейнер
// блоку вже сидить на bg-neutral-800 (EXERCISE_BLOCK_CLASS,
// task-card-style.ts), той самий відтінок на hover був би непомітний.
export const STUDENT_LINK_BUTTON =
  "font-heading rounded-md border border-brand px-3 py-1.5 text-sm shadow-sm transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-700";

// Заголовок-тогл акордеон-блоку студентської сторінки ("Скрипт",
// "Вокабуляр", script-section.tsx/vocab-section.tsx) — свідомо БЕЗ вигляду
// картки (рамка/фон/тінь/padding пробували раніше в обидва боки — і голим
// текстом, і карткою — це вже третя ітерація): має виглядати як звичайний
// h2 розділу сторінки (STUDENT_SECTION_HEADING) поруч із "Відео"/
// "Практика"/"Завдання", лише клікабельний. Колір — НЕ заданий тут навмисно:
// h2 усередині (без власного кольору) і шеврон-іконка (currentColor)
// успадковують один і той самий колір від цього button, тож hover:text-brand
// тут одразу перефарбовує ОБИДВА разом, без окремих класів на кожному.
export const STUDENT_TOGGLE_HEADER_BUTTON =
  "font-heading flex cursor-pointer items-center gap-2 rounded text-left transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand dark:hover:text-brand";

// Незворотна дія (видалити назавжди).
export const BUTTON_DANGER =
  "font-heading rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50 disabled:opacity-50";
export const BUTTON_DANGER_SM =
  "font-heading rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50 disabled:opacity-50";
