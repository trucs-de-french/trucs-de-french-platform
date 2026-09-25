// Спільні примітиви для перетягування-з-вставкою (insert, не swap) — один
// перетягнутий елемент стає РІВНО на місце, куди його кинули, решта
// зсувається, а не міняється місцями парами. Використовується і
// студентськими SortableTileRow (letter_rearrangement/reorder), і
// адмінськими списками впорядкування (сцени/блоки сцени/задачі блоку/
// посилання "Практики"/репліки скрипту тощо).
//
// Свідомо БЕЗ React-стану тут — кожен список має власну (різну) логіку
// персистенції (інший action на кожен домен), тож ділити є сенс лише
// саму МАТЕМАТИКУ переміщення, не повний хук з обгорнутим onDrop.

export type DropSide = "before" | "after";

// Стандартна "видалити з from, вставити на to" семантика (той самий
// принцип, що arrayMove у dnd-kit) — на відміну від swap (обмін місцями
// пари елементів), тут усе МІЖ from і to зсувається на одну позицію.
export function arrayMove<T>(array: T[], from: number, to: number): T[] {
  if (from === to) return array;
  const next = array.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

// Половина елемента під курсором визначає "до" чи "після" — ліва/права для
// горизонтального ряду плиток, верхня/нижня для вертикального списку.
export function resolveDropSide(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  axis: "horizontal" | "vertical"
): DropSide {
  if (axis === "horizontal") {
    return clientX < rect.left + rect.width / 2 ? "before" : "after";
  }
  return clientY < rect.top + rect.height / 2 ? "before" : "after";
}

// Переводить (over-індекс у ВИХІДНОМУ масиві + сторона) у фінальний індекс
// для arrayMove — з поправкою на те, що видалення "from" зсуває всі позиції
// ПІСЛЯ нього на одну вперед.
export function computeInsertIndex(from: number, over: number, side: DropSide): number {
  const insertAt = side === "before" ? over : over + 1;
  return insertAt > from ? insertAt - 1 : insertAt;
}
