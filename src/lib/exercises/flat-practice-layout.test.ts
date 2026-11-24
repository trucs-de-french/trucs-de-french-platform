// Немає тестового фреймворку в проєкті (package.json) — простий assert-
// скрипт, той самий принцип, що format-reveal-answer.test.ts.
// Запуск вручну: npx tsx src/lib/exercises/flat-practice-layout.test.ts
//
// Задача "no holes in the middle of the grid" — pairPracticeItems тепер:
// короткі пари → мішана пара (ЛИШЕ коли S і L обидва непарні, непарна
// коротка + найкоротша непарна довга) → довгі пари → одинока картка
// (ЛИШЕ коли точно ОДНЕ з S/L непарне) — fillerAfter (попередня задача)
// повністю прибрано: під цим новим порядком непарна картка НІКОЛИ не
// лишається в середині блоку, тож filler ніколи не потрібен.
import { pairPracticeItems, type PracticeCardClass } from "./flat-practice-layout";

let failures = 0;
function assert(condition: boolean, label: string) {
  if (!condition) {
    failures++;
    console.error(`FAIL: ${label}`);
  }
}

const SHORT: PracticeCardClass = "short";
const LONG: PracticeCardClass = "long";

// lines — довільне, але РЕАЛІСТИЧНЕ значення: short завжди lines=1 (за
// визначенням класу), long — довільне число ≥2 (тут 2 чи 3, щоб
// перевірити тай-брейк "найкоротша" довга).
function s(id: string) {
  return { id, cardClass: SHORT, lines: 1 };
}
function l(id: string, lines = 2) {
  return { id, cardClass: LONG, lines };
}

// --- S even, L even: усі пари, жодної одинокої картки ----------------------

{
  const out = pairPracticeItems([s("a"), s("b"), l("p"), l("q")]);
  assert(out.map((i) => i.id).join(",") === "a,b,p,q", "S even, L even: shorts first (paired), then longs (paired)");
  assert(out.map((i) => i.displayNumber).join(",") === "1,2,3,4", "sequential numbering");
}

// --- S odd, L even: the single leftover is the short, LAST card ------------

{
  const out = pairPracticeItems([s("a"), s("b"), s("c"), l("p"), l("q")]);
  assert(
    out.map((i) => i.id).join(",") === "a,b,p,q,c",
    "S odd, L even: short pairs, then long pairs, then the leftover short LAST"
  );
}

// --- S even, L odd: the single leftover is a long, LAST card ---------------

{
  const out = pairPracticeItems([s("a"), s("b"), l("p"), l("q"), l("r")]);
  assert(
    out.map((i) => i.id).join(",") === "a,b,p,q,r",
    "S even, L odd: short pairs, then long pairs, then the leftover long LAST"
  );
}

// --- S odd, L odd: mixed pair with the SHORTEST leftover long, NO hole -----

{
  // longs: p(lines=3), q(lines=2) — q is shorter, so the leftover short
  // (c) pairs with q, not p; p pairs normally with... wait only 2 longs
  // here (both odd count needs an odd total) — use 3 longs so one is
  // "leftover-eligible" and the other two form a normal pair.
  const out = pairPracticeItems([s("a"), s("b"), s("c"), l("p", 3), l("q", 2), l("r", 4)]);
  assert(
    out.map((i) => i.id).join(",") === "a,b,c,q,p,r",
    "S odd, L odd: short pairs first, then the mixed pair (leftover short + SHORTEST long q), then the remaining long pair (p,r) — no hole"
  );
  assert(out.map((i) => i.displayNumber).join(",") === "1,2,3,4,5,6", "numbering stays sequential across the mixed pair");
}

// --- S odd, L odd: tie-break for "shortest" is stable (first occurrence wins) --

{
  // longs: p(2), q(2), r(3) — 3 longs (odd), p and q tie at the minimum
  // (lines=2) — p appears first, so it's the one picked as "shortest"
  // (stable first-match), paired with the leftover short; q and r form
  // the remaining long-long pair.
  const out = pairPracticeItems([s("a"), l("p", 2), l("q", 2), l("r", 3)]);
  assert(
    out.map((i) => i.id).join(",") === "a,p,q,r",
    "S odd, L odd, tie: the FIRST long with the minimum lines (p) is picked for the mixed pair, not q"
  );
}

// --- only shorts (L=0) ------------------------------------------------------

{
  const outEven = pairPracticeItems([s("a"), s("b")]);
  assert(outEven.map((i) => i.id).join(",") === "a,b", "only shorts, even count: paired, no leftover");

  const outOdd = pairPracticeItems([s("a"), s("b"), s("c")]);
  assert(outOdd.map((i) => i.id).join(",") === "a,b,c", "only shorts, odd count: paired + the leftover short last");
}

// --- only longs (S=0) --------------------------------------------------------

{
  const outEven = pairPracticeItems([l("p"), l("q")]);
  assert(outEven.map((i) => i.id).join(",") === "p,q", "only longs, even count: paired, no leftover");

  const outOdd = pairPracticeItems([l("p"), l("q"), l("r")]);
  assert(outOdd.map((i) => i.id).join(",") === "p,q,r", "only longs, odd count: paired + the leftover long last");
}

// --- single card -------------------------------------------------------------

{
  const outShort = pairPracticeItems([s("only")]);
  assert(outShort.length === 1 && outShort[0]!.id === "only", "a single short card is the only (leftover) row");

  const outLong = pairPracticeItems([l("only")]);
  assert(outLong.length === 1 && outLong[0]!.id === "only", "a single long card is the only (leftover) row");
}

// --- empty list --------------------------------------------------------------

{
  const out = pairPracticeItems([]);
  assert(out.length === 0, "an empty list produces an empty list, not a crash");
}

// --- ids are passed through untouched, only order/numbering change ---------

{
  const items = [
    { id: 42, cardClass: SHORT, lines: 1 },
    { id: 7, cardClass: LONG, lines: 2 },
  ];
  const out = pairPracticeItems(items);
  assert(out.every((i) => typeof i.id === "number"), "ids keep their original type/value, never regenerated");
  assert(new Set(out.map((i) => i.id)).size === 2, "every input id appears exactly once in the output");
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
}
console.log("All flat-practice-layout tests passed.");
