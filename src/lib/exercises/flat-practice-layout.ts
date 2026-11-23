// Задача "unified card layout rule for letter practice" — ЗАМІНЮЄ попередні
// незалежні правила (orphan/overflowsColumn/lines-based pairing-tolerance):
// pairPracticeItems тепер парує картки практики (letter_gaps/
// letter_rearrangement, інлайн-блок "Робота над помилками" БЕЗ openMode, і
// сцена-вигляд блоків openMode="scene") за ЄДИНОЮ класифікацією
// (cardClass, рахованою викликачем — letterGapsCardClass/
// letterRearrangementCardClass, estimate-card-rows.ts):
//
// - "short" (overflow<=0, картка вже влазить в один рядок half-width) —
//   парується з короткими;
// - "long" (overflow>=3 АБО слово не влазить в один рядок навіть на
//   full-width) — переноситься на 2+ рядки всередині half-width картки,
//   парується з довгими;
// - "wideSingleLine" (overflow 1 чи 2 "тайли" — слову не вистачає 1-2
//   літер/плиток до стандартної половинної картки — АЛЕ воно влазить в
//   ОДИН рядок на full-width) — НІКОЛИ не парується: власний рядок,
//   content-width (wideWidthPx, wide-card-width.ts).
//
// wideWidthPx — готова ЗОВНІШНЯ ширина (px) картки, рахована викликачем
// (letterGapsWideCardWidthPx/letterRearrangementWideCardWidthPx,
// wide-card-width.ts) — ПОТРІБНА лише для cardClass:"wideSingleLine"
// елементів (сортування "найширша перша" і сама CSS-ширина картки),
// ігнорується для short/long.
export type PracticeCardClass = "short" | "long" | "wideSingleLine";
export type FlatPracticeItemInput<Id> = {
  id: Id;
  cardClass: PracticeCardClass;
  wideWidthPx?: number;
};
export type FlatPracticeLayoutItem<Id> = { id: Id; displayNumber: number; full: boolean; wideWidthPx?: number };

// Порядок рядків — РІВНО той, що задача вимагає:
// 1. короткі з короткими (у вихідному порядку, стабільно); непарний
//    залишок лишається ОДИН у half-width колонці В КІНЦІ групи коротких
//    (full:false — "та сама ширина, що в інших", НЕ content-width;
//    CSS-грід сам лишає другу клітинку рядка порожньою).
// 2. довгі з довгими (та сама стабільна пара по два, без жодної перевірки
//    різниці кількості рядків — рівна висота рядка забезпечується самим
//    grid stretch, не підбором схожих карток); непарний залишок — та сама
//    "один у half-width колонці" поведінка, що й непарний короткий.
// 3. "wideSingleLine" картки — У КІНЦІ, кожна ОКРЕМИМ рядком (full:true,
//    content-width), сортовані за wideWidthPx ЗА ЗМЕНШЕННЯМ (найширша
//    перша), стабільно для рівних значень (тай-брейк за вихідним
//    індексом, не лише надія на стабільність Array.sort).
// displayNumber — наскрізна нумерація В ЦЬОМУ порядку рядків, 1-based; id
// (перевірка/збереження/API) лишається незмінним. Мобільний (1-колонковий)
// вигляд не парує картки взагалі (CSS-брейкпоінт, не цей файл) — та сама
// послідовність рядків (короткі → довгі → wideSingleLine) просто стає
// вертикальним списком.
export function pairPracticeItems<Id>(items: FlatPracticeItemInput<Id>[]): FlatPracticeLayoutItem<Id>[] {
  type Item = FlatPracticeItemInput<Id>;
  const shorts: Item[] = [];
  const longs: Item[] = [];
  const wideSingleLine: Item[] = [];
  for (const item of items) {
    if (item.cardClass === "wideSingleLine") wideSingleLine.push(item);
    else if (item.cardClass === "short") shorts.push(item);
    else longs.push(item);
  }

  const rows: { items: Item[]; full: boolean }[] = [];

  for (let i = 0; i + 1 < shorts.length; i += 2) {
    rows.push({ items: [shorts[i], shorts[i + 1]], full: false });
  }
  if (shorts.length % 2 === 1) {
    rows.push({ items: [shorts[shorts.length - 1]], full: false });
  }

  for (let i = 0; i + 1 < longs.length; i += 2) {
    rows.push({ items: [longs[i], longs[i + 1]], full: false });
  }
  if (longs.length % 2 === 1) {
    rows.push({ items: [longs[longs.length - 1]], full: false });
  }

  const sortedWideSingleLine = wideSingleLine
    .map((item, i) => ({ item, i }))
    .sort((a, b) => (b.item.wideWidthPx ?? 0) - (a.item.wideWidthPx ?? 0) || a.i - b.i)
    .map(({ item }) => item);
  for (const w of sortedWideSingleLine) {
    rows.push({ items: [w], full: true });
  }

  const ordered: FlatPracticeLayoutItem<Id>[] = [];
  let n = 1;
  for (const row of rows) {
    for (const item of row.items) {
      ordered.push({ id: item.id, displayNumber: n++, full: row.full, wideWidthPx: item.wideWidthPx });
    }
  }
  return ordered;
}
