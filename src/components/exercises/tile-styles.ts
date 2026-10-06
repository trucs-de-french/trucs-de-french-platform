// Спільний вигляд плиток для reorder і drag_drop — щоб виглядали й
// відчувались однаково.

import { SELECTED_OPTION_CLASS } from "./selection-style";

// Спільний липкий пул слів (image_match 58e5ac6, fill_blank a240340,
// drag_drop тут) — непрозорий фон/рамка в тон EXERCISE_BLOCK_CLASS, на
// мобільних один рядок із горизонтальною прокруткою (менше висоти над
// текстом/картками), від sm: перенос рядків з обмеженою max-height і
// вертикальною прокруткою всередині. Значення max-height/padding/min-height
// лишені ПОВНІСТЮ ЛІТЕРАЛЬНИМИ під кожен тип (а не зібрані інтерполяцією
// рядка) — Tailwind JIT шукає клас як текст у вихідниках, динамічний
// `py-${x}`/`max-h-[${x}vh]` він не згенерує.
//
// px-1 + -mx-1: чипи пулу мають тінь (shadow-sm, див. bankTileClass), а пул —
// overflow-x-auto/overflow-y-auto, що обрізає тінь по краю скрол-області
// без внутрішнього відступу. px-1 дає тіні місце всередині скрол-контейнера,
// -mx-1 зсуває сам контейнер назад так, щоб видимий лівий/правий край пулу
// лишився на тому самому місці, що й до змін (сусідні елементи — текст
// речень/карток — не зсуваються). Вертикальний padding так само зміщено
// (менше згори, більше знизу) замість збільшення — сумарна висота py не
// зросла, пул не став помітно вищим.
export type StickyPoolVariant = "image-match" | "fill-blank" | "drag-drop";

export function stickyPoolClass(variant: StickyPoolVariant): string {
  switch (variant) {
    case "image-match":
      return "sticky top-0 z-10 -mx-1 flex min-h-12 flex-nowrap gap-2 overflow-x-auto rounded-md border-b border-gray-200 bg-neutral-50 px-1 pb-1.5 pt-0.5 sm:max-h-[30vh] sm:flex-wrap sm:overflow-x-visible sm:overflow-y-auto dark:border-neutral-700 dark:bg-neutral-900";
    case "fill-blank":
      // gap-x-1.5/gap-y-2 (не gap-2) — чипи fill_blank нижчі (fill-blank.tsx),
      // gap-y-2 (8px) лишає місце для невидимої зони дотику (before:-inset-y),
      // щоб сусідні рядки чипів не перекривались.
      return "sticky top-0 z-10 -mx-1 flex flex-nowrap gap-x-1.5 gap-y-2 overflow-x-auto rounded-md border-b border-gray-200 bg-neutral-50 px-1 pb-2 pt-1 sm:max-h-[25vh] sm:flex-wrap sm:overflow-x-visible sm:overflow-y-auto dark:border-neutral-700 dark:bg-neutral-900";
    case "drag-drop":
      return "sticky top-0 z-10 -mx-1 flex min-h-12 flex-nowrap gap-2 overflow-x-auto rounded-md border-b border-gray-200 bg-neutral-50 px-1 pb-2 pt-1 sm:max-h-[25vh] sm:flex-wrap sm:overflow-x-visible sm:overflow-y-auto dark:border-neutral-700 dark:bg-neutral-900";
  }
}

export function bankTileClass({ selected, used }: { selected: boolean; used: boolean }) {
  // shadow-sm — та сама тінь-еталон, що на плитках letter_rearrangement
  // (sortable-tile-row.tsx) і letter_gaps.tsx; у base (не в кожній гілці
  // нижче), тож вона та сама в усіх станах — вибраний/використаний/звичайний.
  const base =
    "cursor-grab select-none rounded-md border px-3 py-1.5 text-base shadow-sm active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40";
  if (used) return `${base} opacity-40`;
  if (selected) return `${base} ${SELECTED_OPTION_CLASS}`;
  return `${base} border-gray-200 bg-white hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-800/70`;
}

export type SlotState = "empty" | "hover" | "filled" | "correct" | "incorrect";

// rounded: "sm" (замовчування, drag_drop — не чіпати) чи "lg" (image_match —
// більший слот під картинкою). emptyBg: "none" (замовчування, drag_drop)
// чи "subtle" (image_match — порожній слот трохи темніший за картку, не
// лише на hover). selectableHint: true (лише image_match, лише коли в пулі
// клікнуте слово вибране і цей слот порожній) замінює порожній дашед-стиль
// на акцентний — підказка, куди можна покласти вибране слово дотиком; за
// замовчуванням false, drag_drop цей параметр не передає. Колір рамки/
// заливки для решти станів лишається спільним для обох типів.
export function slotClass(
  state: SlotState,
  opts?: { rounded?: "sm" | "lg"; emptyBg?: "none" | "subtle"; selectableHint?: boolean }
) {
  const radius = opts?.rounded === "lg" ? "rounded-lg" : "rounded";
  const base = `cursor-pointer ${radius} border-2 text-center transition-colors`;
  switch (state) {
    case "correct":
      return `${base} border-green-500 bg-green-50 dark:bg-green-950/30`;
    case "incorrect":
      return `${base} border-red-500 bg-red-50 dark:bg-red-950/30`;
    case "hover":
      return `${base} border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30`;
    case "filled":
      // Слот зі словом до перевірки — той самий вигляд "обрано", що й у
      // multiple_choice/true_false/matching, щоб студент бачив свій вибір
      // до натискання "Перевірити", а не лише за текстом усередині.
      return `${base} border-solid ${SELECTED_OPTION_CLASS}`;
    default:
      if (opts?.selectableHint) {
        return `${base} border-dashed border-brand bg-brand/5 dark:bg-brand/10`;
      }
      return opts?.emptyBg === "subtle"
        ? `${base} border-dashed border-neutral-400 bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-900/50 dark:hover:bg-neutral-900`
        : `${base} border-dashed border-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800`;
  }
}
