// Немає тестового фреймворку в проєкті (package.json) — простий assert-
// скрипт, той самий принцип, що format-reveal-answer.test.ts.
// Запуск вручну: npx tsx src/lib/exercises/flat-practice-layout.test.ts
import { pairPracticeItems } from "./flat-practice-layout";

let failures = 0;
function assert(condition: boolean, label: string) {
  if (!condition) {
    failures++;
    console.error(`FAIL: ${label}`);
  }
}

// lines — та сама величина, що викликачі (letter-gaps.tsx/letter-
// rearrangement.tsx) тепер передають з estimateLetterGapsCardRows/
// estimateLetterRearrangementCardRows (estimate-card-rows.ts) — ЦЕЙ файл
// лише перевіряє чисту логіку парування/сортування за вже готовим
// числом рядків, не саму оцінку (та має власні тести, estimate-card-
// rows.test.ts, якщо існує — тут lines задаються напряму, без проксі
// через довжину символів, задача "pairing still mispairs cards 5/6, 7/8":
// довжина символів НЕ пропорційна реальній кількості рядків для
// letter_gaps, звідси й перехід на lines замість length).
const SHORT = 1;
const LINES_2 = 2;
const LINES_3 = 3;

// --- all-short: усі парами, жодного full-рядка -----------------------------

{
  const out = pairPracticeItems([
    { id: "a", lines: SHORT },
    { id: "b", lines: SHORT },
    { id: "c", lines: SHORT },
    { id: "d", lines: SHORT },
  ]);
  assert(out.map((i) => i.id).join(",") === "a,b,c,d", "all-short (even count) keeps original order");
  assert(out.every((i) => !i.full), "all-short even count has no full-width row");
  assert(out.map((i) => i.displayNumber).join(",") === "1,2,3,4", "sequential numbering");
}

// --- all-long: усі парами, жодного full-рядка -------------------------------

{
  const out = pairPracticeItems([
    { id: "p", lines: LINES_2 },
    { id: "q", lines: LINES_3 },
    { id: "r", lines: LINES_2 },
    { id: "s", lines: LINES_3 },
  ]);
  assert(out.map((i) => i.id).join(",") === "p,q,r,s", "all-long (even count) keeps original order");
  assert(out.every((i) => !i.full), "all-long even count has no full-width row");
}

// --- odd shorts, no longs at all: the lone short stands alone, HALF-width --
// Задача "a lone card in the last row must stay half-width" — full:true
// тепер ТІЛЬКИ коли overflowsColumn:true (тут не передано -> false).

{
  const out = pairPracticeItems([
    { id: "a", lines: SHORT },
    { id: "b", lines: SHORT },
    { id: "c", lines: SHORT },
  ]);
  assert(out.map((i) => i.id).join(",") === "a,b,c", "odd shorts with no longs keep original order");
  assert(
    out[0]!.full === false && out[1]!.full === false && out[2]!.full === false,
    "the first pair stays paired, the odd third short stands alone but stays half-width (no overflow)"
  );
}

// --- odd shorts, no longs, the lone short genuinely overflows the column --

{
  const out = pairPracticeItems([
    { id: "a", lines: SHORT },
    { id: "b", lines: SHORT },
    { id: "c", lines: SHORT, overflowsColumn: true },
  ]);
  assert(
    out[2]!.full === true,
    "an odd lone card that genuinely cannot fit one column (overflowsColumn:true) still spans full-width"
  );
}

// --- odd shorts, first long differs by exactly 1 line: they pair up --------

{
  const out = pairPracticeItems([
    { id: "a", lines: SHORT },
    { id: "b", lines: SHORT },
    { id: "c", lines: SHORT },
    { id: "long2", lines: LINES_2 },
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

// --- odd shorts, first long differs by 2+ lines: no pairing, both stand alone, HALF-width --

{
  const out = pairPracticeItems([
    { id: "a", lines: SHORT },
    { id: "b", lines: SHORT },
    { id: "c", lines: SHORT },
    { id: "long3", lines: LINES_3 },
  ]);
  assert(
    out.map((i) => i.id).join(",") === "a,b,c,long3",
    "order is still short-group-first, long-group-last"
  );
  assert(
    out[2]!.full === false,
    "the odd short does not pair with a long that differs by 2+ lines — it stands alone, but stays half-width (no overflow)"
  );
  assert(out[3]!.full === false, "the single remaining long (now unpaired) also stands alone, half-width");
}

// --- odd longs: the lone long stands alone, HALF-width, at the end ---------

{
  const out = pairPracticeItems([
    { id: "a", lines: SHORT },
    { id: "b", lines: SHORT },
    { id: "p", lines: LINES_2 },
    { id: "q", lines: LINES_2 },
    { id: "r", lines: LINES_2 },
  ]);
  assert(out.map((i) => i.id).join(",") === "a,b,p,q,r", "shorts first (paired), then longs (paired + odd one last)");
  assert(out[0]!.full === false && out[1]!.full === false, "the two shorts pair up");
  assert(out[2]!.full === false && out[3]!.full === false, "the first two longs pair up");
  assert(out[4]!.full === false, "the odd third long stands alone, half-width (no overflow), at the end");
}

// --- odd long leftover that genuinely overflows the column keeps full-width --

{
  const out = pairPracticeItems([
    { id: "p", lines: LINES_2 },
    { id: "q", lines: LINES_2 },
    { id: "r", lines: LINES_2, overflowsColumn: true },
  ]);
  assert(
    out[2]!.full === true,
    "an odd long leftover with overflowsColumn:true still spans full-width, as today"
  );
}

// --- mix: even shorts and even longs — no full rows at all ------------------

{
  const out = pairPracticeItems([
    { id: "a", lines: SHORT },
    { id: "b", lines: SHORT },
    { id: "p", lines: LINES_2 },
    { id: "q", lines: LINES_3 },
  ]);
  assert(out.map((i) => i.id).join(",") === "a,b,p,q", "even shorts then even longs, both groups stay in order");
  assert(out.every((i) => !i.full), "no full-width row needed when both groups are even");
}

// --- empty list --------------------------------------------------------------

{
  const out = pairPracticeItems([]);
  assert(out.length === 0, "an empty list produces an empty list, not a crash");
}

// --- single card: stands alone, HALF-width unless it overflows the column --

{
  const outShort = pairPracticeItems([{ id: "only", lines: SHORT }]);
  assert(outShort.length === 1 && outShort[0]!.full === false, "a single short card stands alone, half-width (no overflow)");

  const outLong = pairPracticeItems([{ id: "only", lines: LINES_2 }]);
  assert(outLong.length === 1 && outLong[0]!.full === false, "a single long card stands alone, half-width (no overflow)");

  const outOverflow = pairPracticeItems([{ id: "only", lines: LINES_2, overflowsColumn: true }]);
  assert(outOverflow.length === 1 && outOverflow[0]!.full === true, "a single card that genuinely overflows the column still spans full-width");
}

// --- 3+ lines never pairs with anything shorter than itself-1 --------------

{
  // A long-long pair where one has 2 lines and the other 4 lines is still a
  // normal pair (pairing only restricts the SHORT/first-long boundary — two
  // "long" items never get a line-difference check between each other).
  const out = pairPracticeItems([
    { id: "p", lines: LINES_2 },
    { id: "q", lines: 4 },
  ]);
  assert(out.every((i) => !i.full), "two long items always pair with each other regardless of their own line gap");
}

// --- ids are passed through untouched, only order/numbering/full change ---

{
  const items = [{ id: 42, lines: 1 }, { id: 7, lines: 5 }];
  const out = pairPracticeItems(items);
  assert(out.every((i) => typeof i.id === "number"), "ids keep their original type/value, never regenerated");
  assert(new Set(out.map((i) => i.id)).size === 2, "every input id appears exactly once in the output");
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
}
console.log("All flat-practice-layout tests passed.");
