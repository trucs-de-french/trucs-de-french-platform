// Немає тестового фреймворку в проєкті (package.json) — простий assert-
// скрипт, той самий принцип, що task-display-name.test.ts.
// Запуск вручну: npx tsx src/lib/exercises/format-reveal-answer.test.ts
import {
  buildGapRowsFromReveal,
  buildTableFillAnswerRowsFromReveal,
  buildMatchingPairRowsFromReveal,
} from "./format-reveal-answer";

let failures = 0;
function assert(condition: boolean, label: string) {
  if (!condition) {
    failures++;
    console.error(`FAIL: ${label}`);
  }
}

// --- buildGapRowsFromReveal (letter_gaps) --------------------------------

{
  // "bonjour" з прихованими позиціями 0,3,6 (b,j,r) — chars: [null,"o","n",
  // null,"o","u",null]. reveal для цього слова повертає ПОВНЕ слово.
  const chars = [[null, "o", "n", null, "o", "u", null] as (string | null)[]];
  const rows = buildGapRowsFromReveal([0], chars, { 0: "bonjour" });
  assert(rows.length === 1 && rows[0].number === 1, "one row, numbered from 1");
  assert(
    JSON.stringify(rows[0].parts) === JSON.stringify([{ word: "b" }, "on", { word: "j" }, "ou", { word: "r" }]),
    "hidden positions become {word} spans at the right places, adjacent hidden letters merge"
  );
}

{
  // Слово, чий reveal ще не прийшов (не в кеші) — порожні літери замість
  // кидання помилки (loading-стан, не crash).
  const chars = [[null, "a"] as (string | null)[]];
  const rows = buildGapRowsFromReveal([0], chars, {});
  assert(JSON.stringify(rows[0].parts) === JSON.stringify([{ word: "" }, "a"]), "missing reveal falls back to an empty letter, not a crash");
}

// --- buildTableFillAnswerRowsFromReveal (table_fill) ---------------------

{
  const rows = [
    { id: "r1", left: null, right: "chat" }, // left hidden
    { id: "r2", left: "chien", right: null }, // right hidden
    { id: "r3", left: null, right: null }, // both hidden
  ];
  const revealed: Record<string, string[]> = {
    r1: ["un chat"],
    r2: ["dog"],
    r3: ["un oiseau", "bird"],
  };
  const out = buildTableFillAnswerRowsFromReveal(rows, 0, revealed);
  assert(out.length === 3, "one row per input row");
  assert(out[0].left === "un chat" && out[0].leftIsAnswer && out[0].right === "chat" && !out[0].rightIsAnswer, "left-hidden row: left comes from reveal, right stays the known value");
  assert(out[1].right === "dog" && out[1].rightIsAnswer && out[1].left === "chien" && !out[1].leftIsAnswer, "right-hidden row: right comes from reveal, left stays the known value");
  assert(out[2].left === "un oiseau" && out[2].right === "bird" && out[2].leftIsAnswer && out[2].rightIsAnswer, "both-hidden row: left then right, in that order, both from reveal");
  assert(out[0].number === 1 && out[1].number === 2 && out[2].number === 3, "numberOffset=0 gives 1-based numbers");
}

{
  const rows = [{ id: "r1", left: null, right: "chat" }];
  const out = buildTableFillAnswerRowsFromReveal(rows, 4, { r1: ["un chat"] });
  assert(out[0].number === 5, "numberOffset shifts the displayed row number");
}

// --- buildMatchingPairRowsFromReveal (matching) --------------------------

{
  const idByLeft = new Map([
    ["chien", "pair-1"],
    ["chat", "pair-2"],
  ]);
  const revealed: Record<string, string[]> = { "pair-1": ["dog"] };
  const out = buildMatchingPairRowsFromReveal(["chien", "chat"], idByLeft, revealed);
  assert(out[0].left === "chien" && out[0].right === "dog", "revealed pair gets its right text");
  assert(out[1].left === "chat" && out[1].right === "", "not-yet-revealed pair falls back to an empty right, not a crash");
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
} else {
  console.log("All format-reveal-answer tests passed.");
}
