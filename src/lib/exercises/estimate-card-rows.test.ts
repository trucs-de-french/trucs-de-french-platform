// Немає тестового фреймворку в проєкті (package.json) — простий assert-
// скрипт, той самий принцип, що flat-practice-layout.test.ts.
// Запуск вручну: npx tsx src/lib/exercises/estimate-card-rows.test.ts
//
// Задача "unified card layout rule for letter practice" — перевіряє
// РЕАЛЬНІ числові приклади класифікації (letterGapsCardClass/
// letterRearrangementCardClass) на даних слова/плиток, а не лише чисту
// логіку парування (та тестується окремо, flat-practice-layout.test.ts,
// де cardClass задається напряму, без проксі через ці естіматори).
//
// Калібрувальні приклади зі скріншотів ("часто"/"якийсь" 10 тайлів,
// "взуття" 9 тайлів) і явні порогові приклади задачі (9/10/11/12 тайлів,
// фраза з двох слів ~20 тайлів на двох рядках, слово, що й на full-width
// потребує 2+ рядки) — усі перевірені нижче.
import {
  classifyPracticeCard,
  estimateLetterGapsCardRows,
  estimateLetterRearrangementCardRows,
  letterGapsCardClass,
  letterRearrangementCardClass,
} from "./estimate-card-rows";

let failures = 0;
function assert(condition: boolean, label: string) {
  if (!condition) {
    failures++;
    console.error(`FAIL: ${label}`);
  }
}

// --- classifyPracticeCard: the pure threshold function itself --------------
// Порогові числа буквально з задачі: overflow<=0 -> short; 1 чи 2 І
// влазить на full -> wideSingleLine; інакше (>=3, АБО не влазить на full)
// -> long.

{
  assert(classifyPracticeCard(0, true) === "short", "overflow 0 is always short");
  assert(classifyPracticeCard(-5, true) === "short", "negative overflow (content well under half-width) is short");
  assert(classifyPracticeCard(1, true) === "wideSingleLine", "overflow 1, fits one line at full -> wideSingleLine");
  assert(classifyPracticeCard(2, true) === "wideSingleLine", "overflow 2, fits one line at full -> wideSingleLine");
  assert(classifyPracticeCard(3, true) === "long", "overflow 3 is long even when it would fit one line at full");
  assert(classifyPracticeCard(8, true) === "long", "large overflow (8) is long regardless of fitting one line at full");
  assert(classifyPracticeCard(1, false) === "long", "overflow 1 but NOT fitting one line at full is long, never standalone");
  assert(classifyPracticeCard(2, false) === "long", "overflow 2 but NOT fitting one line at full is long, never standalone");
}

// --- letter_rearrangement: real tile-count examples from the task ----------
// REFERENCE_ROW_WIDTH_PX=330, FIXED_CELL_PX=32, FIXED_CELL_GAP_PX=3.4 ->
// half-width tile capacity floor((330+3.4)/35.4)=9, full-width capacity
// floor((672+3.4)/35.4)=19 (estimate-card-rows.ts).

// 9 tiles ("взуття", screenshot) -> fits one half-width line already -> short.
{
  assert(estimateLetterRearrangementCardRows(9) === 1, "letter_rearrangement: 9 tiles fit one half-width line");
  assert(letterRearrangementCardClass(9) === "short", "letter_rearrangement: 9 tiles ('взуття') -> short");
}

// 10 tiles ("часто"/"якийсь", screenshot) -> overflow 1, fits one line at
// full -> wideSingleLine.
{
  assert(letterRearrangementCardClass(10) === "wideSingleLine", "letter_rearrangement: 10 tiles ('часто'/'якийсь') -> wideSingleLine");
}

// 11 tiles -> overflow 2, fits one line at full -> wideSingleLine.
{
  assert(letterRearrangementCardClass(11) === "wideSingleLine", "letter_rearrangement: 11 tiles -> wideSingleLine (overflow 2)");
}

// 12 tiles -> overflow 3 -> long, wraps to 2 lines inside a half-width card.
{
  assert(estimateLetterRearrangementCardRows(12) === 2, "letter_rearrangement: 12 tiles wrap to 2 lines inside a half-width card");
  assert(letterRearrangementCardClass(12) === "long", "letter_rearrangement: 12 tiles -> long (overflow 3)");
}

// 20 tiles -> needs 2+ lines even at full row width -> long, never standalone.
{
  assert(estimateLetterRearrangementCardRows(20, 672) === 2, "letter_rearrangement: 20 tiles still need 2 lines even at full row width");
  assert(letterRearrangementCardClass(20) === "long", "letter_rearrangement: 20 tiles -> long, never standalone, even though it needs 2 lines everywhere");
}

// 1 tile -> trivially short.
{
  assert(letterRearrangementCardClass(1) === "short", "letter_rearrangement: a single tile is short");
}

// --- letter_gaps: phrase examples (multi-word, real estimator) -------------

function visibleUnit(n: number): string[] {
  return Array.from({ length: n }, () => "a");
}
function phraseOfUnits(unitLengths: number[]): string[] {
  const chars: string[] = [];
  unitLengths.forEach((n, i) => {
    if (i > 0) chars.push(" ");
    chars.push(...visibleUnit(n));
  });
  return chars;
}

// A single short unit (11 visible letters, 121px) -> fits one half-width
// line -> short.
{
  const chars = phraseOfUnits([11]);
  assert(estimateLetterGapsCardRows(chars, []) === 1, "letter_gaps: a single 121px unit fits one half-width line");
  assert(letterGapsCardClass(chars, []) === "short", "letter_gaps: a single short unit -> short");
}

// Two-word phrase (~20 "tiles" worth of width: two 198px units, 18 visible
// letters each) rendered on two lines at half-width (198+8+198=404 >330) ->
// overflow = ceil((404-330)/35.4) = 3 -> long, pairs with another long card
// (matches "опустошити тарілку, з'їсти все" / "сиротинець" / "поцілувати":
// a multi-unit phrase that needs 2 real lines at half-width is long, even
// though the SAME content would fit one line at full width: 404<=672 ->
// the magnitude threshold (overflow>=3) wins over the full-width fit, per
// the task's rule 3).
{
  const chars = phraseOfUnits([18, 18]);
  assert(estimateLetterGapsCardRows(chars, []) === 2, "letter_gaps: a two-unit ~404px phrase needs 2 lines at half-width");
  assert(
    letterGapsCardClass(chars, []) === "long",
    "letter_gaps: a two-word phrase needing 2 lines at half-width -> long (overflow 3), even though it would fit one line at full width"
  );
}

// A word/phrase that needs 2+ lines even at FULL row width (two 352px
// units, 32 visible letters each: 352+8+352=712 > 672) -> long, never
// standalone (matches "невдячність"/long words where even full-width
// doesn't help).
{
  const chars = phraseOfUnits([32, 32]);
  assert(
    letterGapsCardClass(chars, []) === "long",
    "letter_gaps: content needing 2+ lines even at full row width -> long, never standalone"
  );
}

// A single long unit (~594px, 54 visible letters, like "невдячність" ~600px
// of tiles) that WOULD fit one line at full width (594<=672) but has large
// overflow (>=3) at half-width -> still long, not promoted to
// wideSingleLine just because it happens to fit one line at full.
{
  const chars = phraseOfUnits([54]);
  assert(
    letterGapsCardClass(chars, []) === "long",
    "letter_gaps: large overflow (~8 tiles) stays long even though the content fits one line at full width (~600px <= 672px)"
  );
}

// Odd/mix/empty/single-card pairing scenarios (short/long/wideSingleLine
// buckets, widest-to-narrowest ordering, stability) are covered on the
// pure pairPracticeItems logic in flat-practice-layout.test.ts - this file
// only verifies the numeric classification feeding that logic.

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
}
console.log("All estimate-card-rows (unified card layout rule) tests passed.");
