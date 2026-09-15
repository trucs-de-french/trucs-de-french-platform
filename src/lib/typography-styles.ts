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
