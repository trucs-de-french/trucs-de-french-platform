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
// rows.test.ts — там lines задаються напряму, без проксі через довжину
// символів).
//
// Задача "width-by-content rule must ALSO apply to a lone card" — `full`
// тепер означає ОДНЕ: "ця картка одинока у своєму рядку сітки" (orphan,
// overflowsColumn, АБО звичайний непарний залишок пари, що не знайшов
// партнера) — УСІ вони однаково стають окремим рядком у КІНЦІ списку,
// сортованим за wideWidthPx (найширший спочатку). full:false лишається
// лише для СПРАВЖНІХ пар (2 картки в одному рядку).
const SHORT = 1;
const LINES_2 = 2;
const LINES_3 = 3;

// --- all-short: усі парами, жодного одинокого рядка ------------------------

{
  const out = pairPracticeItems([
    { id: "a", lines: SHORT },
    { id: "b", lines: SHORT },
    { id: "c", lines: SHORT },
    { id: "d", lines: SHORT },
  ]);
  assert(out.map((i) => i.id).join(",") === "a,b,c,d", "all-short (even count) keeps original order");
  assert(out.every((i) => !i.full), "all-short even count has no standalone row");
  assert(out.map((i) => i.displayNumber).join(",") === "1,2,3,4", "sequential numbering");
}

// --- all-long: усі парами, жодного одинокого рядка --------------------------

{
  const out = pairPracticeItems([
    { id: "p", lines: LINES_2 },
    { id: "q", lines: LINES_3 },
    { id: "r", lines: LINES_2 },
    { id: "s", lines: LINES_3 },
  ]);
  assert(out.map((i) => i.id).join(",") === "p,q,r,s", "all-long (even count) keeps original order");
  assert(out.every((i) => !i.full), "all-long even count has no standalone row");
}

// --- odd shorts, no longs at all: the lone short becomes a standalone row --
// Задача "width-by-content rule must ALSO apply to a lone card" — a plain
// unpaired leftover is NOW also `full:true` (content-width, not simply
// "half-width by default") — the exact outer width it renders at is
// decided by the CSS clamp (wide-card-width.ts/computeWideCardOuterWidthPx,
// tested separately), which for content that already fits one column
// naturally resolves to the half-column minimum, so nothing changes
// visually for this case — only the `full` flag/row grouping changes.

{
  const out = pairPracticeItems([
    { id: "a", lines: SHORT },
    { id: "b", lines: SHORT },
    { id: "c", lines: SHORT },
  ]);
  assert(out.map((i) => i.id).join(",") === "a,b,c", "odd shorts with no longs keep original order");
  assert(
    out[0]!.full === false && out[1]!.full === false && out[2]!.full === true,
    "the first pair stays paired; the odd third short becomes its own standalone row"
  );
}

// --- odd shorts, no longs, the lone short genuinely overflows the column --

{
  const out = pairPracticeItems([
    { id: "a", lines: SHORT },
    { id: "b", lines: SHORT },
    { id: "c", lines: SHORT, overflowsColumn: true },
  ]);
  assert(out[2]!.full === true, "an odd lone card that genuinely cannot fit one column (overflowsColumn:true) is a standalone row");
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
    "the odd short and the first long form a paired (non-standalone) row together"
  );
}

// --- odd shorts, first long differs by 2+ lines: no pairing, both become standalone rows --

{
  const out = pairPracticeItems([
    { id: "a", lines: SHORT },
    { id: "b", lines: SHORT },
    { id: "c", lines: SHORT },
    { id: "long3", lines: LINES_3 },
  ]);
  assert(out.map((i) => i.id).join(",") === "a,b,c,long3", "order is still short-group-first, long-group-last");
  assert(out[2]!.full === true, "the odd short does not pair with a long that differs by 2+ lines — it becomes a standalone row");
  assert(out[3]!.full === true, "the single remaining long (now unpaired) also becomes a standalone row");
}

// --- odd longs: the lone long becomes a standalone row, at the end ---------

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
  assert(out[4]!.full === true, "the odd third long becomes a standalone row, at the end");
}

// --- odd long leftover that genuinely overflows the column -----------------

{
  const out = pairPracticeItems([
    { id: "p", lines: LINES_2 },
    { id: "q", lines: LINES_2 },
    { id: "r", lines: LINES_2, overflowsColumn: true },
  ]);
  assert(out[2]!.full === true, "an odd long leftover with overflowsColumn:true is a standalone row, as before");
}

// --- mix: even shorts and even longs — no standalone rows at all -----------

{
  const out = pairPracticeItems([
    { id: "a", lines: SHORT },
    { id: "b", lines: SHORT },
    { id: "p", lines: LINES_2 },
    { id: "q", lines: LINES_3 },
  ]);
  assert(out.map((i) => i.id).join(",") === "a,b,p,q", "even shorts then even longs, both groups stay in order");
  assert(out.every((i) => !i.full), "no standalone row needed when both groups are even");
}

// --- empty list --------------------------------------------------------------

{
  const out = pairPracticeItems([]);
  assert(out.length === 0, "an empty list produces an empty list, not a crash");
}

// --- single card: always becomes a standalone row ---------------------------

{
  const outShort = pairPracticeItems([{ id: "only", lines: SHORT }]);
  assert(outShort.length === 1 && outShort[0]!.full === true, "a single short card is a standalone row");

  const outLong = pairPracticeItems([{ id: "only", lines: LINES_2 }]);
  assert(outLong.length === 1 && outLong[0]!.full === true, "a single long card is a standalone row");

  const outOverflow = pairPracticeItems([{ id: "only", lines: LINES_2, overflowsColumn: true }]);
  assert(outOverflow.length === 1 && outOverflow[0]!.full === true, "a single card that genuinely overflows the column is a standalone row");
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

// --- orphan card: never paired, becomes a standalone row, moved to the end --
// Задача "orphan card in the last tile line" — orphan:true картки виймаються
// з пулу парування ПЕРШИМИ (ще до short/long-класифікації), ніколи не
// паруються з сусідом, і йдуть ОКРЕМИМИ рядками У КІНЦІ, разом з усіма
// іншими одинокими картками.

{
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
  assert(out[4]!.full === true, "the orphan card is a standalone row");
  assert(out.map((i) => i.displayNumber).join(",") === "1,2,3,4,5", "numbering stays sequential across the standalone row");
}

// --- orphan:false long cards pair normally ----------------------------------

{
  const out = pairPracticeItems([
    { id: "p", lines: LINES_2, orphan: false },
    { id: "q", lines: LINES_2, orphan: false },
  ]);
  assert(out.every((i) => !i.full), "orphan:false long cards pair normally");
}

// --- odd counts WITH an orphan present: the orphan still never pairs -------

{
  const out = pairPracticeItems([
    { id: "p", lines: LINES_2 },
    { id: "q", lines: LINES_2 },
    { id: "r", lines: LINES_2, orphan: true },
  ]);
  assert(out.map((i) => i.id).join(",") === "p,q,r", "the two normal longs pair, the orphan stands alone at the end");
  assert(out[0]!.full === false && out[1]!.full === false, "the two non-orphan longs pair up");
  assert(out[2]!.full === true, "the orphan long is a standalone row");
}

// --- orphan that still would not fit even at full width (overflowsColumn) --

{
  const out = pairPracticeItems([{ id: "only", lines: LINES_3, orphan: true, overflowsColumn: true }]);
  assert(out.length === 1 && out[0]!.full === true, "a card flagged both orphan and overflowsColumn is still a standalone row");
}

// --- all orphans, no wideWidthPx given (tie): keeps original order ---------

{
  const out = pairPracticeItems([
    { id: "x", lines: LINES_2, orphan: true },
    { id: "y", lines: LINES_3, orphan: true },
    { id: "z", lines: LINES_2, orphan: true },
  ]);
  assert(out.map((i) => i.id).join(",") === "x,y,z", "all-orphan input with no wideWidthPx (all tie at 0) keeps original order");
  assert(out.every((i) => i.full), "every orphan card is a standalone row, none paired");
}

// --- standalone rows are ordered widest-to-narrowest (task "staircase") ----

{
  const out = pairPracticeItems([
    { id: "narrow", lines: LINES_2, orphan: true, wideWidthPx: 200 },
    { id: "wide", lines: LINES_2, orphan: true, wideWidthPx: 500 },
    { id: "medium", lines: LINES_2, orphan: true, wideWidthPx: 350 },
  ]);
  assert(
    out.map((i) => i.id).join(",") === "wide,medium,narrow",
    "standalone rows are reordered widest-to-narrowest by wideWidthPx, regardless of input order"
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

// --- a plain unpaired leftover joins the SAME sorted standalone bucket -----
// --- as orphan/overflow cards, ordered together by wideWidthPx -------------

{
  const out = pairPracticeItems([
    { id: "s1", lines: SHORT },
    { id: "s2", lines: SHORT },
    { id: "s3", lines: SHORT, wideWidthPx: 250 }, // plain odd leftover, narrow
    { id: "wideOrphan", lines: LINES_2, orphan: true, wideWidthPx: 500 },
  ]);
  assert(
    out.map((i) => i.id).join(",") === "s1,s2,wideOrphan,s3",
    "paired shorts come first; the plain leftover (s3) and the orphan are sorted TOGETHER, widest first"
  );
  assert(out[2]!.full === true && out[3]!.full === true, "both the orphan and the plain leftover are standalone rows");
}

// --- mix: shorts + longs + standalone rows, each paired bucket ordered independently -----

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
    "shorts pair first, then longs pair, then standalone rows at the end in their original relative order (tie, no wideWidthPx)"
  );
  assert(out[0]!.full === false && out[1]!.full === false, "the two shorts pair");
  assert(out[2]!.full === false && out[3]!.full === false, "the two longs pair");
  assert(out[4]!.full === true && out[5]!.full === true, "both orphans are standalone rows, at the end");
}

// --- wideWidthPx is carried through to the output unchanged ----------------

{
  const out = pairPracticeItems([{ id: "only", lines: LINES_2, orphan: true, wideWidthPx: 412 }]);
  assert(out[0]!.wideWidthPx === 412, "wideWidthPx passes through from input to output unchanged, for the caller's CSS");
}

// --- empty list (orphan/wideWidthPx fields present but unused) -------------

{
  const out = pairPracticeItems([] as { id: string; lines: number; orphan?: boolean; wideWidthPx?: number }[]);
  assert(out.length === 0, "an empty list still produces an empty list, not a crash");
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
