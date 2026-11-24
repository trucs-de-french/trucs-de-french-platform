// Задача "simplification of the card layout for letter practice" — усі
// картки практики (letter_gaps/letter_rearrangement, інлайн-блок "Робота
// над помилками" БЕЗ openMode, і сцена-вигляд блоків openMode="scene")
// ЗАВЖДИ half-width, однакового розміру, без жодного винятку — cardClass
// ("short"/"long", рахований викликачем — letterGapsPracticeLayout/
// letterRearrangementPracticeLayout, estimate-card-rows.ts) визначає лише
// ПОРЯДОК парування, не ширину.
//
// Задача "no holes in the middle of the grid" (п.4, pairing) — ЗАМІНЮЄ
// попереднє правило (непарний короткий лишався сам ПЕРЕД групою довгих,
// потребуючи невидимий "filler", щоб перша довга картка не стала йому
// парою): якщо І короткі, І довгі непарні — непарна коротка парується з
// НАЙКОРОТШОЮ (найменша кількість рядків, lines) непарною довгою в ОДНОМУ
// рядку (мішана пара, рівна висота рядка — стандартна поведінка CSS grid
// stretch, жодного додаткового стилю) — ЖОДНОЇ дірки немає взагалі. Якщо
// непарна лише ОДНА з груп (чи обидві парні) — одинока картка лишається
// сама в ОСТАННЬОМУ рядку блоку (половинна колонка, порожня друга
// клітинка — єдине допустиме місце для дірки). Порядок: короткі пари,
// потім мішана пара (якщо є), потім довгі пари, потім одинока картка
// (якщо є) — filler-елемент (.practice-grid-filler, попередня задача)
// більше НІКОЛИ не потрібен (одинока картка завжди остання, ніщо не йде
// після неї в сітці) — прибраний разом з fillerAfter.
import type { PracticeCardClass } from "./estimate-card-rows";

export type { PracticeCardClass };
// lines — задача "no holes in the middle of the grid": кількість рядків
// плиток/одиниць ПІСЛЯ збалансованого переносу (те саме число, що
// визначило cardClass) — потрібне ЛИШЕ для вибору "найкоротшої" довгої
// картки при мішаному парuванні (short.cardClass завжди lines<=1 за
// визначенням, тож для коротких це поле не впливає на результат).
export type FlatPracticeItemInput<Id> = { id: Id; cardClass: PracticeCardClass; lines: number };
export type FlatPracticeLayoutItem<Id> = { id: Id; displayNumber: number };

// Порядок — короткі пари, (мішана пара якщо S і L обидва непарні), довгі
// пари, одинока картка (якщо лишилась). displayNumber — наскрізна
// нумерація В ЦЬОМУ порядку, 1-based; id (перевірка/збереження/API)
// лишається незмінним. Мобільний (1-колонковий) вигляд рендерить той
// самий порядок простим вертикальним списком (CSS-брейкпоінт, не цей
// файл).
export function pairPracticeItems<Id>(items: FlatPracticeItemInput<Id>[]): FlatPracticeLayoutItem<Id>[] {
  type Item = FlatPracticeItemInput<Id>;
  const shorts = items.filter((item) => item.cardClass === "short");
  const longs = items.filter((item) => item.cardClass === "long");

  const shortPairs: Item[][] = [];
  for (let i = 0; i + 1 < shorts.length; i += 2) shortPairs.push([shorts[i], shorts[i + 1]]);
  const oddShort = shorts.length % 2 === 1 ? shorts[shorts.length - 1] : null;
  const oddLongExists = longs.length % 2 === 1;

  let longsForPairing = longs;
  let mixedPair: Item[] | null = null;
  let lone: Item | null = null;

  if (oddShort && oddLongExists) {
    // Задача "pair the leftover short card with the shortest leftover
    // long card" — stable-first мінімум за lines (перше трапляння
    // мінімуму виграє при рівності, не довільний вибір сортуванням).
    let shortestIdx = 0;
    for (let i = 1; i < longs.length; i++) {
      if (longs[i].lines < longs[shortestIdx].lines) shortestIdx = i;
    }
    const shortestLong = longs[shortestIdx];
    longsForPairing = longs.filter((_, i) => i !== shortestIdx);
    mixedPair = [oddShort, shortestLong];
  } else if (oddShort) {
    // Лише короткі непарні — одинока картка (ЛИШЕ коротка, бо довгих
    // парна кількість — longsForPairing нижче повністю розпадеться на
    // пари, без власного залишку).
    lone = oddShort;
  }

  const longPairs: Item[][] = [];
  for (let i = 0; i + 1 < longsForPairing.length; i += 2) longPairs.push([longsForPairing[i], longsForPairing[i + 1]]);
  if (longsForPairing.length % 2 === 1) {
    lone = longsForPairing[longsForPairing.length - 1];
  }

  const rows: Item[][] = [...shortPairs, ...(mixedPair ? [mixedPair] : []), ...longPairs, ...(lone ? [[lone]] : [])];

  const ordered: FlatPracticeLayoutItem<Id>[] = [];
  let n = 1;
  for (const row of rows) {
    for (const item of row) {
      ordered.push({ id: item.id, displayNumber: n++ });
    }
  }
  return ordered;
}
