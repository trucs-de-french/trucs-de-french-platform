// Задача "simplification of the card layout for letter practice" — ЗАМІНЮЄ
// попередню класифікацію (orphan/overflowsColumn/wideSingleLine,
// content-width карток, сортування "найширша перша") на РІВНО ДВА класи:
// усі картки практики (letter_gaps/letter_rearrangement, інлайн-блок
// "Робота над помилками" БЕЗ openMode, і сцена-вигляд блоків openMode=
// "scene") ЗАВЖДИ half-width, однакового розміру, без жодного винятку —
// cardClass ("short"/"long", рахований викликачем — letterGapsPracticeLayout/
// letterRearrangementPracticeLayout, estimate-card-rows.ts) лише визначає
// ПОРЯДОК парування (короткі з короткими, довгі з довгими), не ширину.
import type { PracticeCardClass } from "./estimate-card-rows";

export type { PracticeCardClass };
export type FlatPracticeItemInput<Id> = { id: Id; cardClass: PracticeCardClass };
// fillerAfter — задача "an odd last card sits alone in a half-width
// column, same width as the others": коли непарний залишок КОРОТКИХ
// (shorts.length є непарним) НЕ є останнім елементом усього списку (після
// нього йдуть ДОВГІ картки) — порожня грід-клітинка його рядка мусить
// лишитись порожньою, інакше звичайний grid auto-flow поставив би туди
// ПЕРШУ довгу картку (ту саму помилку розмітки, що задача "card pairing"
// уже виправляла раніше, тепер без full:true/col-span, тож повернулась би
// без цього прапорця). true — викликач рендерить НЕВИДИМИЙ "filler"-елемент
// (.practice-grid-filler, globals.css: display:none нижче md, block на
// md+ — порожня клітинка їм видно ЛИШЕ у 2-колонковому режимі, де вона й
// потрібна; на мобільному елемент відсутній у потоці взагалі, одноколонковий
// список лишається без жодної зайвої прогалини) одразу ПІСЛЯ цієї картки.
// Якщо непарний залишок — ОСТАННІЙ елемент списку (довгих карток немає чи
// вони вже всі перед ним — неможливо за порядком "короткі→довгі", але
// якщо ДОВГИХ просто немає взагалі), filler не потрібен: порожня друга
// клітинка останнього рядка і так нічим не зайнята.
export type FlatPracticeLayoutItem<Id> = { id: Id; displayNumber: number; fillerAfter?: boolean };

// Порядок — короткі пари, потім довгі пари, непарний залишок кожної групи
// лишається сам (half-width, та сама ширина, що в інших — жодного
// спеціального стилю не потрібно, звичайна поведінка CSS grid, коли йому
// явно не заважає чужий сусід, див. fillerAfter вище). displayNumber —
// наскрізна нумерація В ЦЬОМУ порядку, 1-based; id (перевірка/збереження/
// API) лишається незмінним. Мобільний (1-колонковий) вигляд рендерить той
// самий порядок простим вертикальним списком (CSS-брейкпоінт, не цей
// файл) — filler-елементи там відсутні в потоці взагалі (display:none).
export function pairPracticeItems<Id>(items: FlatPracticeItemInput<Id>[]): FlatPracticeLayoutItem<Id>[] {
  const shorts = items.filter((item) => item.cardClass === "short");
  const longs = items.filter((item) => item.cardClass === "long");
  const needsFillerAfterShorts = shorts.length % 2 === 1 && longs.length > 0;

  const ordered: FlatPracticeLayoutItem<Id>[] = [];
  let n = 1;
  shorts.forEach((item, i) => {
    const isLastShort = i === shorts.length - 1;
    ordered.push({
      id: item.id,
      displayNumber: n++,
      fillerAfter: isLastShort && needsFillerAfterShorts,
    });
  });
  longs.forEach((item) => {
    ordered.push({ id: item.id, displayNumber: n++ });
  });
  return ordered;
}
