// Розмір клітинки сітки (word_search/crossword) — 3 фіксовані пари
// (мобільна/sm:десктопна), обрані за РОЗМІРОМ СІТКИ (кількість колонок), не
// viewport: маленька сітка лишається комфортною (до 40px на десктопі),
// найбільша (WORD_SEARCH_MAX_GRID=15 — той самий орієнтир для crossword,
// хоч його власна сітка органічна й формального максимуму не має) звужується
// до підлоги ~28px/десктоп, ~20px/мобільний. ЛІТЕРАЛЬНІ рядки класів (не
// `h-[${px}px]` з інтерпольованою змінною) — Tailwind сканує вихідний код на
// предмет точних рядків класів, динамічно побудований клас просто не
// потрапив би у фінальний CSS (той самий принцип, що вже пояснено в
// task-type-meta.ts).
//
// box/text розділені — word_search кладе текст напряму в <td> (box+text на
// тому самому елементі), crossword кладе текст в <input> усередині <td>
// (box на <td>, text на <input>) — обидва консьюмери самі комбінують те, що
// їм треба.
export type GridCellSize = { box: string; text: string };

export function gridCellSize(gridSize: number): GridCellSize {
  if (gridSize <= 10) return { box: "h-8 w-8 sm:h-10 sm:w-10", text: "text-sm sm:text-lg" };
  if (gridSize <= 12) return { box: "h-7 w-7 sm:h-9 sm:w-9", text: "text-xs sm:text-base" };
  return { box: "h-5 w-5 sm:h-7 sm:w-7", text: "text-[10px] sm:text-sm" };
}
