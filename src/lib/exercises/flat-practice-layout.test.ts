// Немає тестового фреймворку в проєкті (package.json) — простий assert-
// скрипт, той самий принцип, що format-reveal-answer.test.ts.
// Запуск вручну: npx tsx src/lib/exercises/flat-practice-layout.test.ts
import { layoutFlatPracticeItems, FLAT_PRACTICE_LONG_WORD_THRESHOLD } from "./flat-practice-layout";

let failures = 0;
function assert(condition: boolean, label: string) {
  if (!condition) {
    failures++;
    console.error(`FAIL: ${label}`);
  }
}

assert(FLAT_PRACTICE_LONG_WORD_THRESHOLD === 8, "threshold derived from the layout constants is 8 tiles");

// --- short-first, stable order -------------------------------------------

{
  const threshold = FLAT_PRACTICE_LONG_WORD_THRESHOLD;
  const out = layoutFlatPracticeItems([
    { id: "a", length: threshold + 1 },
    { id: "b", length: 3 },
    { id: "c", length: threshold + 2 },
    { id: "d", length: 1 },
  ]);
  assert(out.map((i) => i.id).join(",") === "b,d,a,c", "short items keep their original order and come first, long items follow in their original order");
  assert(out.map((i) => i.displayNumber).join(",") === "1,2,3,4", "display numbers are renumbered sequentially in the new order");
}

// --- threshold boundary (affects ordering, not a per-item flag) -----------

{
  const out = layoutFlatPracticeItems([
    { id: "over", length: FLAT_PRACTICE_LONG_WORD_THRESHOLD + 1 },
    { id: "exact", length: FLAT_PRACTICE_LONG_WORD_THRESHOLD },
  ]);
  assert(out.map((i) => i.id).join(",") === "exact,over", "an item exactly at the threshold is short (sorts before an over-threshold item), not long");
}

// --- all-short -------------------------------------------------------------

{
  const out = layoutFlatPracticeItems([
    { id: "x", length: 2 },
    { id: "y", length: 4 },
  ]);
  assert(out.map((i) => i.id).join(",") === "x,y", "all-short input keeps its original order unchanged");
}

// --- all-long ----------------------------------------------------------------

{
  const out = layoutFlatPracticeItems([
    { id: "p", length: 20 },
    { id: "q", length: 15 },
  ]);
  assert(out.map((i) => i.id).join(",") === "p,q", "all-long input keeps its original order unchanged");
}

// --- continuous flow: an odd short count is followed by the first long item
// in the same grid row (no span, no empty cell) -----------------------------

{
  const threshold = FLAT_PRACTICE_LONG_WORD_THRESHOLD;
  const out = layoutFlatPracticeItems([
    { id: "s1", length: 2 },
    { id: "s2", length: 3 },
    { id: "s3", length: 1 },
    { id: "l1", length: threshold + 1 },
  ]);
  assert(out.map((i) => i.id).join(",") === "s1,s2,s3,l1", "3 short items (odd) are immediately followed by the long item, no gap in the flow");
  assert(out.map((i) => i.displayNumber).join(",") === "1,2,3,4", "numbering stays sequential across the short/long boundary");
}

// --- empty list --------------------------------------------------------------

{
  const out = layoutFlatPracticeItems([]);
  assert(out.length === 0, "an empty list produces an empty list, not a crash");
}

// --- ids are passed through untouched, only order/numbering change ---------

{
  const items = [{ id: 42, length: 1 }, { id: 7, length: 50 }];
  const out = layoutFlatPracticeItems(items);
  assert(out.every((i) => typeof i.id === "number"), "ids keep their original type/value, never regenerated");
  assert(new Set(out.map((i) => i.id)).size === 2, "every input id appears exactly once in the output");
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
}
console.log("All flat-practice-layout tests passed.");
