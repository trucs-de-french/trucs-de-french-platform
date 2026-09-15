// Централізовані типографічні ролі — той самий принцип, що button-styles.ts
// і input-styles.ts: рядок класів, не компонент, підставляється напряму в
// className= будь-де. Мета та сама — наступна правка розміру/кольору ролі
// це правка в ОДНОМУ файлі, а не в десятках.

// Заголовок секції сторінки (напр. "Сцени", "Тести", "Матеріали") —
// 16-18px/semibold, менше й легше за page-title h1 (text-2xl font-bold).
export const H2_TEXT = "text-lg font-semibold text-gray-800 dark:text-neutral-200";

// Посилання "назад" угорі сторінки (напр. "← До списку курсів") і "До
// кабінету" — без підкреслення, нейтральний сірий у спокої, колір бренду
// на hover замість підкреслення як єдиного сигналу інтерактивності.
export const BREADCRUMB_LINK =
  "text-sm text-slate-500 no-underline hover:text-brand dark:text-neutral-400 dark:hover:text-brand";

// Назва поля форми (напр. "Назва", "Тип завдання") — 14px/medium/gray-700,
// темніший і важчий за HINT_TEXT, щоб лейбл читався окремо від підказки під
// полем. Кожне місце виклику саме дописує свій layout-префікс (mt-1, flex
// items-center gap-N) поверх цього рядка — той самий принцип, що INPUT_BORDER
// свідомо без padding.
export const LABEL_TEXT = "text-sm font-medium text-gray-700 dark:text-neutral-300";

// Допоміжний текст/підказка під полем, і дрібні капшени в списках (напр.
// "Блок · {type}") — 12px/normal/gray-500, той самий вигляд, що вже був до
// централізації, просто іменована константа замість розкиданого рядка.
export const HINT_TEXT = "text-xs text-neutral-500 dark:text-neutral-400";
