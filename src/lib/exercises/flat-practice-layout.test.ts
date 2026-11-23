// Немає тестового фреймворку в проєкті (package.json) — простий assert-
// скрипт, той самий принцип, що format-reveal-answer.test.ts.
// Запуск вручну: npx tsx src/lib/exercises/flat-practice-layout.test.ts
import { pairPracticeItems, FLAT_PRACTICE_LONG_WORD_THRESHOLD } from "./flat-practice-layout";

let failures = 0;
function assert(condition: boolean, label: string) {
  if (!condition) {
    failures++;
    console.error(`FAIL: ${label}`);
  }
}

const T = FLAT_PRACTICE_LONG_WORD_THRESHOLD;
assert(T === 8, "threshold derived from the layout constants is 8 tiles");

// Довжини для точних кількостей рядків (lineCountFor): 1 рядок <= T,
// 2 рядки — (T, 2T], 3 рядки — (2T, 3T].
const SHORT = 1;
const LONG_2_LINES = T + 1;
const LONG_3_LINES = 2 * T + 1;

// --- all-short: усі парами, жодного full-рядка -----------------------------

{
  const out = pairPracticeItems([
    { id: "a", length: SHORT },
    { id: "b", length: SHORT },
    { id: "c", length: SHORT },
    { id: "d", length: SHORT },
  ]);
  assert(out.map((i) => i.id).join(",") === "a,b,c,d", "all-short (even count) keeps original order");
  assert(out.every((i) => !i.full), "all-short even count has no full-width row");
  assert(out.map((i) => i.displayNumber).join(",") === "1,2,3,4", "sequential numbering");
}

// --- all-long: усі парами, жодного full-рядка -------------------------------

{
  const out = pairPracticeItems([
    { id: "p", length: LONG_2_LINES },
    { id: "q", length: LONG_3_LINES },
    { id: "r", length: LONG_2_LINES },
    { id: "s", length: LONG_3_LINES },
  ]);
  assert(out.map((i) => i.id).join(",") === "p,q,r,s", "all-long (even count) keeps original order");
  assert(out.every((i) => !i.full), "all-long even count has no full-width row");
}

// --- odd shorts, no longs at all: the lone short stands alone, full --------

{
  const out = pairPracticeItems([
    { id: "a", length: SHORT },
    { id: "b", length: SHORT },
    { id: "c", length: SHORT },
  ]);
  assert(out.map((i) => i.id).join(",") === "a,b,c", "odd shorts with no longs keep original order");
  assert(
    out[0]!.full === false && out[1]!.full === false && out[2]!.full === true,
    "the first pair stays paired, the odd third short stands alone full-width"
  );
}

// --- odd shorts, first long differs by exactly 1 line: they pair up --------

{
  const out = pairPracticeItems([
    { id: "a", length: SHORT },
    { id: "b", length: SHORT },
    { id: "c", length: SHORT },
    { id: "long2", length: LONG_2_LINES },
  ]);
  assert(
    out.map((i) => i.id).join(",") === "a,b,c,long2",
    "odd short pairs with the first long when they differ by exactly 1 line"
  );
  assert(
    out[2]!.full === false && out[3]!.full === false,
    "the odd short and the first long form a paired (non-full) row together"
  );
}

// --- odd shorts, first long differs by 2+ lines: no pairing, both stand alone --

{
  const out = pairPracticeItems([
    { id: "a", length: SHORT },
    { id: "b", length: SHORT },
    { id: "c", length: SHORT },
    { id: "long3", length: LONG_3_LINES },
  ]);
  assert(
    out.map((i) => i.id).join(",") === "a,b,c,long3",
    "order is still short-group-first, long-group-last"
  );
  assert(
    out[2]!.full === true,
    "the odd short does not pair with a long that differs by 2+ lines — it stands alone"
  );
  assert(out[3]!.full === true, "the single remaining long (now unpaired) also stands alone");
}

// --- odd longs: the lone long stands alone, full, at the end ---------------

{
  const out = pairPracticeItems([
    { id: "a", length: SHORT },
    { id: "b", length: SHORT },
    { id: "p", length: LONG_2_LINES },
    { id: "q", length: LONG_2_LINES },
    { id: "r", length: LONG_2_LINES },
  ]);
  assert(out.map((i) => i.id).join(",") === "a,b,p,q,r", "shorts first (paired), then longs (paired + odd one last)");
  assert(out[0]!.full === false && out[1]!.full === false, "the two shorts pair up");
  assert(out[2]!.full === false && out[3]!.full === false, "the first two longs pair up");
  assert(out[4]!.full === true, "the odd third long stands alone, full-width, at the end");
}

// --- mix: even shorts and even longs — no full rows at all ------------------

{
  const out = pairPracticeItems([
    { id: "a", length: SHORT },
    { id: "b", length: SHORT },
    { id: "p", length: LONG_2_LINES },
    { id: "q", length: LONG_3_LINES },
  ]);
  assert(out.map((i) => i.id).join(",") === "a,b,p,q", "even shorts then even longs, both groups stay in order");
  assert(out.every((i) => !i.full), "no full-width row needed when both groups are even");
}

// --- empty list --------------------------------------------------------------

{
  const out = pairPracticeItems([]);
  assert(out.length === 0, "an empty list produces an empty list, not a crash");
}

// --- single card: always stands alone, full-width --------------------------

{
  const outShort = pairPracticeItems([{ id: "only", length: SHORT }]);
  assert(outShort.length === 1 && outShort[0]!.full === true, "a single short card stands alone, full-width");

  const outLong = pairPracticeItems([{ id: "only", length: LONG_2_LINES }]);
  assert(outLong.length === 1 && outLong[0]!.full === true, "a single long card stands alone, full-width");
}

// --- threshold boundary (affects line count, not a per-item flag) ----------

{
  const out = pairPracticeItems([
    { id: "over", length: T + 1 },
    { id: "exact", length: T },
  ]);
  assert(
    out.map((i) => i.id).join(",") === "exact,over",
    "an item exactly at the threshold is short (1 line, sorts before an over-threshold item), not long"
  );
}

// --- ids are passed through untouched, only order/numbering/full change ---

{
  const items = [{ id: 42, length: 1 }, { id: 7, length: 50 }];
  const out = pairPracticeItems(items);
  assert(out.every((i) => typeof i.id === "number"), "ids keep their original type/value, never regenerated");
  assert(new Set(out.map((i) => i.id)).size === 2, "every input id appears exactly once in the output");
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
}
console.log("All flat-practice-layout tests passed.");
