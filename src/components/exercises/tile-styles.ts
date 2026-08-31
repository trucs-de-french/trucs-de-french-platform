// Спільний вигляд плиток для reorder і drag_drop — щоб виглядали й
// відчувались однаково.

import { SELECTED_OPTION_CLASS } from "./selection-style";

export function bankTileClass({ selected, used }: { selected: boolean; used: boolean }) {
  const base =
    "cursor-grab select-none rounded-md border px-3 py-1.5 text-sm active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40";
  if (used) return `${base} opacity-40`;
  if (selected) return `${base} ${SELECTED_OPTION_CLASS}`;
  return `${base} hover:bg-neutral-50 dark:hover:bg-neutral-800`;
}

export type SlotState = "empty" | "hover" | "filled" | "correct" | "incorrect";

export function slotClass(state: SlotState) {
  const base = "cursor-pointer rounded border-2 text-center transition-colors";
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
      return `${base} border-dashed border-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800`;
  }
}
