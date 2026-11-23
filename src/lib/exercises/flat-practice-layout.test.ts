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

// --- orphan card: never paired, always full-width, moved to the end --------
// Задача "orphan card in the last tile line" — orphan:true картки виймаються
// з пулу парування ПЕРШИМИ (ще до short/long-класифікації), ніколи не
// паруються з сусідом, і йдуть ОКРЕМИМИ full-width рядками У КІНЦІ, у
// вихідному порядку.

{
  // 4 звичайні короткі (паруються як завжди) + 1 orphan (довга картка з
  // позначкою orphan) — orphan НЕ бере участі в парі з жодною короткою чи
  // довгою, виходить окремим full-width рядком останнім.
  const out = pairPracticeItems([
    { id: "a", lines: SHORT },
    { id: "b", lines: SHORT },
    { id: "c", lines: SHORT },
    { id: "d", lines: SHORT },
    { id: "orphan1", lines: LINES_2, orphan: true },
  ]);
  assert(
    out.map((i) => i.id).join(",") === "a,b,c,d,orphan1",
    "orphan card moves to the end, after all paired shorts, in original relative order"
  );
  assert(
    out[0]!.full === false && out[1]!.full === false && out[2]!.full === false && out[3]!.full === false,
    "the four shorts pair up normally, unaffected by the orphan"
  );
  assert(out[4]!.full === true, "the orphan card renders full-width");
  assert(out.map((i) => i.displayNumber).join(",") === "1,2,3,4,5", "numbering stays sequential across the orphan row");
}

// --- orphan is detected independently of being the odd leftover ------------

{
  // Odd short count (3) WITHOUT any orphan: the third short is simply a
  // normal half-width lone leftover (not full) — orphan:true is a SEPARATE
  // signal, never implied just by being unpaired.
  const out = pairPracticeItems([
    { id: "a", lines: SHORT },
    { id: "b", lines: SHORT },
    { id: "c", lines: SHORT },
  ]);
  assert(out[2]!.full === false, "an odd leftover short with no orphan flag stays half-width, not full");
}

// --- orphan NOT detected: estimate-card-rows only sets orphan:true when ---
// --- the half-width last line holds exactly 1 tile — callers passing ------
// --- orphan:false (2+ tiles on the last half-width line) must pair normally

{
  const out = pairPracticeItems([
    { id: "p", lines: LINES_2, orphan: false },
    { id: "q", lines: LINES_2, orphan: false },
  ]);
  assert(out.every((i) => !i.full), "orphan:false long cards pair normally, like before this task");
}

// --- odd counts WITH an orphan present: the orphan still never pairs -------

{
  // 3 longs, the last one flagged orphan: the first two longs pair up as
  // usual; the orphan is pulled OUT before the "odd longs" leftover logic
  // ever runs, so it never ends up accidentally paired or treated as the
  // ordinary half-width leftover.
  const out = pairPracticeItems([
    { id: "p", lines: LINES_2 },
    { id: "q", lines: LINES_2 },
    { id: "r", lines: LINES_2, orphan: true },
  ]);
  assert(out.map((i) => i.id).join(",") === "p,q,r", "the two normal longs pair, the orphan stands alone at the end");
  assert(out[0]!.full === false && out[1]!.full === false, "the two non-orphan longs pair up");
  assert(out[2]!.full === true, "the orphan long renders full-width, not as a half-width leftover");
}

// --- orphan that still would not fit even at full width (overflowsColumn) --
// --- behaves the same as a plain overflow (both pulled out, both full) ----

{
  const out = pairPracticeItems([
    { id: "only", lines: LINES_3, orphan: true, overflowsColumn: true },
  ]);
  assert(out.length === 1 && out[0]!.full === true, "a card flagged both orphan and overflowsColumn is still full-width (no double-counting bug)");
}

// --- all orphans, no wideWidthPx given (tie): keeps original order ---------

{
  const out = pairPracticeItems([
    { id: "x", lines: LINES_2, orphan: true },
    { id: "y", lines: LINES_3, orphan: true },
    { id: "z", lines: LINES_2, orphan: true },
  ]);
  assert(out.map((i) => i.id).join(",") === "x,y,z", "all-orphan input with no wideWidthPx (all tie at 0) keeps original order");
  assert(out.every((i) => i.full), "every orphan card renders full-width, none paired");
}

// --- orphan cards are ordered widest-to-narrowest (task "staircase") ------

{
  const out = pairPracticeItems([
    { id: "narrow", lines: LINES_2, orphan: true, wideWidthPx: 200 },
    { id: "wide", lines: LINES_2, orphan: true, wideWidthPx: 500 },
    { id: "medium", lines: LINES_2, orphan: true, wideWidthPx: 350 },
  ]);
  assert(
    out.map((i) => i.id).join(",") === "wide,medium,narrow",
    "orphan/full-width rows are reordered widest-to-narrowest by wideWidthPx, regardless of input order"
  );
  assert(
    out.map((i) => i.displayNumber).join(",") === "1,2,3",
    "displayNumber is renumbered 1..N in the new widest-to-narrowest order"
  );
}

// --- widest-to-narrowest ordering is stable for ties (same wideWidthPx) ---

{
  const out = pairPracticeItems([
    { id: "a", lines: LINES_2, orphan: true, wideWidthPx: 300 },
    { id: "b", lines: LINES_2, orphan: true, wideWidthPx: 500 },
    { id: "c", lines: LINES_2, orphan: true, wideWidthPx: 300 },
  ]);
  assert(
    out.map((i) => i.id).join(",") === "b,a,c",
    "ties in wideWidthPx (a and c, both 300) keep their original relative order after the wider one (b)"
  );
}

// --- widest-to-narrowest ordering only applies within the full-width bucket,
// --- it never reorders relative to paired short/long rows -----------------

{
  const out = pairPracticeItems([
    { id: "s1", lines: SHORT },
    { id: "s2", lines: SHORT },
    { id: "narrowOrphan", lines: LINES_2, orphan: true, wideWidthPx: 200 },
    { id: "wideOrphan", lines: LINES_2, orphan: true, wideWidthPx: 500 },
  ]);
  assert(
    out.map((i) => i.id).join(",") === "s1,s2,wideOrphan,narrowOrphan",
    "paired shorts still come first; only the orphan bucket itself is sorted widest-first"
  );
}

// --- mix: shorts + longs + orphans, each bucket ordered independently -----

{
  const out = pairPracticeItems([
    { id: "s1", lines: SHORT },
    { id: "orphanA", lines: LINES_2, orphan: true },
    { id: "s2", lines: SHORT },
    { id: "l1", lines: LINES_2 },
    { id: "l2", lines: LINES_3 },
    { id: "orphanB", lines: LINES_2, orphan: true },
  ]);
  assert(
    out.map((i) => i.id).join(",") === "s1,s2,l1,l2,orphanA,orphanB",
    "shorts pair first, then longs pair, then orphans stand alone at the end in their original relative order"
  );
  assert(out[0]!.full === false && out[1]!.full === false, "the two shorts pair");
  assert(out[2]!.full === false && out[3]!.full === false, "the two longs pair");
  assert(out[4]!.full === true && out[5]!.full === true, "both orphans render full-width, at the end");
}

// --- orphan: empty list still produces an empty list, not a crash ---------

{
  const out = pairPracticeItems([] as { id: string; lines: number; orphan?: boolean }[]);
  assert(out.length === 0, "an empty list with the orphan field still produces an empty list");
}

// --- orphan: a single orphan card stands alone, full-width -----------------

{
  const out = pairPracticeItems([{ id: "only", lines: LINES_2, orphan: true }]);
  assert(out.length === 1 && out[0]!.full === true, "a single orphan card still renders full-width");
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
