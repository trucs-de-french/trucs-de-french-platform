// Немає тестового фреймворку в проєкті (package.json) — простий assert-
// скрипт, той самий принцип, що format-reveal-answer.test.ts.
// Запуск вручну: npx tsx src/lib/exercises/flat-practice-layout.test.ts
//
// Задача "unified card layout rule for letter practice" — ЦЕЙ файл
// перевіряє ЛИШЕ чисту логіку парування/сортування за вже готовим
// cardClass (short/long/wideSingleLine) — САМА класифікація (overflow у
// тайлах, "влазить в один рядок на full-width") тестується окремо,
// estimate-card-rows.test.ts, разом із реальними числами зі скріншотів.
import { pairPracticeItems } from "./flat-practice-layout";

let failures = 0;
function assert(condition: boolean, label: string) {
  if (!condition) {
    failures++;
    console.error(`FAIL: ${label}`);
  }
}

const SHORT = "short" as const;
const LONG = "long" as const;
const WIDE = "wideSingleLine" as const;

// --- all-short: усі парами, жодного одинокого рядка ------------------------

{
  const out = pairPracticeItems([
    { id: "a", cardClass: SHORT },
    { id: "b", cardClass: SHORT },
    { id: "c", cardClass: SHORT },
    { id: "d", cardClass: SHORT },
  ]);
  assert(out.map((i) => i.id).join(",") === "a,b,c,d", "all-short (even count) keeps original order");
  assert(out.every((i) => !i.full), "all-short even count has no standalone row");
  assert(out.map((i) => i.displayNumber).join(",") === "1,2,3,4", "sequential numbering");
}

// --- all-long: усі парами, жодного одинокого рядка --------------------------

{
  const out = pairPracticeItems([
    { id: "p", cardClass: LONG },
    { id: "q", cardClass: LONG },
    { id: "r", cardClass: LONG },
    { id: "s", cardClass: LONG },
  ]);
  assert(out.map((i) => i.id).join(",") === "p,q,r,s", "all-long (even count) keeps original order");
  assert(out.every((i) => !i.full), "all-long even count has no standalone row");
}

// --- odd shorts: the lone short sits alone, HALF-width, no content-width ---
// Задача "a lone odd short card sits alone in a half-width column at the
// end of the short group, same width as the others" — full:false (НЕ
// wideSingleLine), жодного content-width розрахунку.

{
  const out = pairPracticeItems([
    { id: "a", cardClass: SHORT },
    { id: "b", cardClass: SHORT },
    { id: "c", cardClass: SHORT },
  ]);
  assert(out.map((i) => i.id).join(",") === "a,b,c", "odd shorts keep original order");
  assert(
    out[0]!.full === false && out[1]!.full === false && out[2]!.full === false,
    "the pair stays paired; the odd third short sits alone, half-width (full:false), same width as the others"
  );
}

// --- odd longs: the lone long sits alone, HALF-width, at the end -----------
// Задача "An odd last long card stays alone in a half-width column."

{
  const out = pairPracticeItems([
    { id: "p", cardClass: LONG },
    { id: "q", cardClass: LONG },
    { id: "r", cardClass: LONG },
  ]);
  assert(out.map((i) => i.id).join(",") === "p,q,r", "odd longs keep original order");
  assert(out[0]!.full === false && out[1]!.full === false, "the pair stays paired");
  assert(out[2]!.full === false, "the odd third long sits alone, half-width (full:false), not content-width");
}

// --- long cards pair regardless of any "row count similarity" check -------
// Задача явно НЕ вимагає перевірки різниці рядків для парування довгих —
// на відміну від попереднього правила (odd short pairs with first long
// only if line-diff<=1) — довгі парується МІЖ СОБОЮ завжди, стабільно.

{
  const out = pairPracticeItems([
    { id: "p", cardClass: LONG },
    { id: "q", cardClass: LONG },
  ]);
  assert(out.every((i) => !i.full), "two long cards always pair with each other, no further condition");
}

// --- mix: even shorts and even longs — no standalone rows at all -----------

{
  const out = pairPracticeItems([
    { id: "a", cardClass: SHORT },
    { id: "b", cardClass: SHORT },
    { id: "p", cardClass: LONG },
    { id: "q", cardClass: LONG },
  ]);
  assert(out.map((i) => i.id).join(",") === "a,b,p,q", "even shorts then even longs, both groups stay in order");
  assert(out.every((i) => !i.full), "no standalone row needed when both groups are even");
}

// --- empty list --------------------------------------------------------------

{
  const out = pairPracticeItems([]);
  assert(out.length === 0, "an empty list produces an empty list, not a crash");
}

// --- single card: always becomes a standalone row, regardless of class ----
// Непарний короткий/довгий "сам" у рядку — full:false (half-width); сам
// wideSingleLine елемент (навіть у кількості 1) — full:true (content-width).

{
  const outShort = pairPracticeItems([{ id: "only", cardClass: SHORT }]);
  assert(outShort.length === 1 && outShort[0]!.full === false, "a single short card sits alone, half-width");

  const outLong = pairPracticeItems([{ id: "only", cardClass: LONG }]);
  assert(outLong.length === 1 && outLong[0]!.full === false, "a single long card sits alone, half-width");

  const outWide = pairPracticeItems([{ id: "only", cardClass: WIDE, wideWidthPx: 400 }]);
  assert(outWide.length === 1 && outWide[0]!.full === true, "a single wideSingleLine card is a standalone, content-width row");
}

// --- wideSingleLine card: never paired, standalone row, moved to the end --

{
  const out = pairPracticeItems([
    { id: "a", cardClass: SHORT },
    { id: "b", cardClass: SHORT },
    { id: "c", cardClass: SHORT },
    { id: "d", cardClass: SHORT },
    { id: "wide1", cardClass: WIDE, wideWidthPx: 420 },
  ]);
  assert(
    out.map((i) => i.id).join(",") === "a,b,c,d,wide1",
    "the wideSingleLine card moves to the end, after all paired shorts"
  );
  assert(
    out[0]!.full === false && out[1]!.full === false && out[2]!.full === false && out[3]!.full === false,
    "the four shorts pair up normally, unaffected by the wideSingleLine card"
  );
  assert(out[4]!.full === true, "the wideSingleLine card renders as a standalone, content-width row");
  assert(out.map((i) => i.displayNumber).join(",") === "1,2,3,4,5", "numbering stays sequential across the standalone row");
}

// --- odd counts WITH a wideSingleLine card present: it still never pairs --

{
  const out = pairPracticeItems([
    { id: "p", cardClass: LONG },
    { id: "q", cardClass: LONG },
    { id: "wide1", cardClass: WIDE, wideWidthPx: 400 },
  ]);
  assert(out.map((i) => i.id).join(",") === "p,q,wide1", "the two normal longs pair, the wideSingleLine card stands alone at the end");
  assert(out[0]!.full === false && out[1]!.full === false, "the two longs pair up");
  assert(out[2]!.full === true, "the wideSingleLine card is a standalone, content-width row");
}

// --- order: short pairs first, then long pairs, then wideSingleLine -------

{
  const out = pairPracticeItems([
    { id: "wideA", cardClass: WIDE, wideWidthPx: 400 },
    { id: "l1", cardClass: LONG },
    { id: "s1", cardClass: SHORT },
    { id: "l2", cardClass: LONG },
    { id: "s2", cardClass: SHORT },
  ]);
  assert(
    out.map((i) => i.id).join(",") === "s1,s2,l1,l2,wideA",
    "shorts pair first, then longs pair, then the wideSingleLine card at the end, regardless of input order"
  );
  assert(out[0]!.full === false && out[1]!.full === false, "the two shorts pair");
  assert(out[2]!.full === false && out[3]!.full === false, "the two longs pair");
  assert(out[4]!.full === true, "the wideSingleLine card is a standalone row, at the end");
}

// --- all wideSingleLine, no wideWidthPx given (tie): keeps original order --

{
  const out = pairPracticeItems([
    { id: "x", cardClass: WIDE },
    { id: "y", cardClass: WIDE },
    { id: "z", cardClass: WIDE },
  ]);
  assert(out.map((i) => i.id).join(",") === "x,y,z", "all-wideSingleLine input with no wideWidthPx (all tie at 0) keeps original order");
  assert(out.every((i) => i.full), "every wideSingleLine card is a standalone row, none paired");
}

// --- wideSingleLine cards are ordered widest-to-narrowest (task "staircase") --

{
  const out = pairPracticeItems([
    { id: "narrow", cardClass: WIDE, wideWidthPx: 200 },
    { id: "wide", cardClass: WIDE, wideWidthPx: 500 },
    { id: "medium", cardClass: WIDE, wideWidthPx: 350 },
  ]);
  assert(
    out.map((i) => i.id).join(",") === "wide,medium,narrow",
    "wideSingleLine rows are reordered widest-to-narrowest by wideWidthPx, regardless of input order"
  );
  assert(
    out.map((i) => i.displayNumber).join(",") === "1,2,3",
    "displayNumber is renumbered 1..N in the new widest-to-narrowest order"
  );
}

// --- widest-to-narrowest ordering is stable for ties (same wideWidthPx) ---

{
  const out = pairPracticeItems([
    { id: "a", cardClass: WIDE, wideWidthPx: 300 },
    { id: "b", cardClass: WIDE, wideWidthPx: 500 },
    { id: "c", cardClass: WIDE, wideWidthPx: 300 },
  ]);
  assert(
    out.map((i) => i.id).join(",") === "b,a,c",
    "ties in wideWidthPx (a and c, both 300) keep their original relative order after the wider one (b)"
  );
}

// --- wideWidthPx is carried through to the output unchanged ----------------

{
  const out = pairPracticeItems([{ id: "only", cardClass: WIDE, wideWidthPx: 412 }]);
  assert(out[0]!.wideWidthPx === 412, "wideWidthPx passes through from input to output unchanged, for the caller's CSS");
}

// --- ids are passed through untouched, only order/numbering/full change ---

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
