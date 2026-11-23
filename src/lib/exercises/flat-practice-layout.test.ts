// Немає тестового фреймворку в проєкті (package.json) — простий assert-
// скрипт, той самий принцип, що format-reveal-answer.test.ts.
// Запуск вручну: npx tsx src/lib/exercises/flat-practice-layout.test.ts
//
// Задача "simplification of the card layout for letter practice" —
// pairPracticeItems тепер парує за ЄДИНОЮ класифікацією ("short"/"long"),
// без wideSingleLine/content-width/full-width — усі картки завжди
// half-width, однакового розміру; fillerAfter замінює колишній
// full/wideWidthPx: true лише коли непарний короткий залишок передує
// групі довгих (інакше звичайний grid auto-flow поставив би туди першу
// довгу картку в тому самому рядку).
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

function item(id: string, cardClass: PracticeCardClass) {
  return { id, cardClass };
}

// --- all-short: усі парами, жодного filler-а -------------------------------

{
  const out = pairPracticeItems([item("a", SHORT), item("b", SHORT), item("c", SHORT), item("d", SHORT)]);
  assert(out.map((i) => i.id).join(",") === "a,b,c,d", "all-short (even count) keeps original order");
  assert(out.every((i) => !i.fillerAfter), "all-short even count needs no filler");
  assert(out.map((i) => i.displayNumber).join(",") === "1,2,3,4", "sequential numbering");
}

// --- all-long: усі парами, жодного filler-а ---------------------------------

{
  const out = pairPracticeItems([item("p", LONG), item("q", LONG), item("r", LONG), item("s", LONG)]);
  assert(out.map((i) => i.id).join(",") === "p,q,r,s", "all-long (even count) keeps original order");
  assert(out.every((i) => !i.fillerAfter), "all-long even count needs no filler");
}

// --- odd shorts, NO longs following: lone short needs no filler ------------
// (nothing follows it that could accidentally share its row)

{
  const out = pairPracticeItems([item("a", SHORT), item("b", SHORT), item("c", SHORT)]);
  assert(out.map((i) => i.id).join(",") === "a,b,c", "odd shorts with no longs keep original order");
  assert(out.every((i) => !i.fillerAfter), "odd shorts with no following longs need no filler (nothing to protect against)");
}

// --- odd shorts, longs follow: the lone short gets a filler -----------------

{
  const out = pairPracticeItems([item("a", SHORT), item("b", SHORT), item("c", SHORT), item("p", LONG), item("q", LONG)]);
  assert(
    out.map((i) => i.id).join(",") === "a,b,c,p,q",
    "shorts (3) come first, in order, then longs (2), in order"
  );
  assert(out[0]!.fillerAfter === undefined || out[0]!.fillerAfter === false, "the first short (paired) has no filler");
  assert(out[1]!.fillerAfter === undefined || out[1]!.fillerAfter === false, "the second short (paired) has no filler");
  assert(out[2]!.fillerAfter === true, "the odd third short (unpaired, longs follow) gets a filler to protect its empty cell");
  assert(out[3]!.fillerAfter === undefined || out[3]!.fillerAfter === false, "long cards never get a filler");
  assert(out.map((i) => i.displayNumber).join(",") === "1,2,3,4,5", "numbering is sequential, unaffected by the filler");
}

// --- odd longs: never gets a filler (nothing of a different class follows) --

{
  const out = pairPracticeItems([item("a", SHORT), item("b", SHORT), item("p", LONG), item("q", LONG), item("r", LONG)]);
  assert(out.map((i) => i.id).join(",") === "a,b,p,q,r", "shorts first (paired), then longs (paired + odd one last)");
  assert(out.every((i) => !i.fillerAfter), "an odd long leftover at the very end never needs a filler");
}

// --- mix: even shorts and even longs — no filler at all ---------------------

{
  const out = pairPracticeItems([item("a", SHORT), item("b", SHORT), item("p", LONG), item("q", LONG)]);
  assert(out.map((i) => i.id).join(",") === "a,b,p,q", "even shorts then even longs, both groups stay in order");
  assert(out.every((i) => !i.fillerAfter), "no filler needed when both groups are even");
}

// --- empty list --------------------------------------------------------------

{
  const out = pairPracticeItems([]);
  assert(out.length === 0, "an empty list produces an empty list, not a crash");
}

// --- single card: always just one item, no filler (nothing to protect against) --

{
  const outShort = pairPracticeItems([item("only", SHORT)]);
  assert(outShort.length === 1 && !outShort[0]!.fillerAfter, "a single short card needs no filler");

  const outLong = pairPracticeItems([item("only", LONG)]);
  assert(outLong.length === 1 && !outLong[0]!.fillerAfter, "a single long card needs no filler");
}

// --- odd shorts AND odd longs together: only the shorts-boundary filler fires --

{
  const out = pairPracticeItems([
    item("a", SHORT),
    item("b", SHORT),
    item("c", SHORT),
    item("p", LONG),
    item("q", LONG),
    item("r", LONG),
  ]);
  assert(out.map((i) => i.id).join(",") === "a,b,c,p,q,r", "3 shorts then 3 longs, both groups kept in order");
  assert(out[2]!.fillerAfter === true, "the odd short (longs follow) gets a filler");
  assert(out[5]!.fillerAfter === undefined || out[5]!.fillerAfter === false, "the odd long at the very end gets no filler");
}

// --- ids are passed through untouched, only order/numbering/filler change ---

{
  const items = [
    { id: 42, cardClass: SHORT },
    { id: 7, cardClass: LONG },
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
