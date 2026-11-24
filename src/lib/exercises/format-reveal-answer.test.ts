// Немає тестового фреймворку в проєкті (package.json) — простий assert-
// скрипт, той самий принцип, що task-display-name.test.ts.
// Запуск вручну: npx tsx src/lib/exercises/format-reveal-answer.test.ts
import {
  buildGapRowsFromReveal,
  buildTableFillAnswerRowsFromReveal,
  buildMatchingPairRowsFromReveal,
  buildRevealedWordDetail,
  buildSortColumnsAnswerColumns,
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

// --- buildRevealedWordDetail (letter_rearrangement) ----------------------

{
  const detail = buildRevealedWordDetail("chien", ["c", "h", "i", "x", "n"]);
  assert(detail.letters.length === 5, "one letter entry per character of the revealed word");
  assert(
    detail.letters.map((l) => l.isCorrect).join(",") === "true,true,true,false,true",
    "each position compares the student's current tile against the revealed letter at that position"
  );
  assert(detail.isCorrect === false, "overall isCorrect is false when any position is wrong");
  assert(detail.letters.every((l, i) => l.text === "chien"[i]), "text at every position is the revealed (correct) letter, not the student's tile");
}

{
  const detail = buildRevealedWordDetail("chat", ["c", "h", "a", "t"]);
  assert(detail.isCorrect === true, "overall isCorrect is true when the student's current order already matches");
}

{
  // Поточний порядок коротший за розкрите слово (студент ще не
  // розставив усі плитки) — undefined !== text, позиція просто
  // неправильна, не crash.
  const detail = buildRevealedWordDetail("chat", ["c", "h"]);
  assert(detail.letters[2].isCorrect === false && detail.letters[3].isCorrect === false, "missing tiles compare as incorrect, not a crash");
}

// --- buildSortColumnsAnswerColumns (sort_columns — задача "answers panel
// must match the scene exercise": той самий груповий вигляд, що звичайна
// вправа, лише columnIdByItemId приходить або з singleDetail
// (correctColumnId напряму), або з reveal-пар "itemId:columnId",
// розібраних викликачем до передачі сюди) -------------------------------

{
  const columns = [
    { id: "c1", label: "Animaux domestiques" },
    { id: "c2", label: "Animaux de la ferme" },
  ];
  const items = [
    { id: "i1", text: "chien" },
    { id: "i2", text: "vache" },
    { id: "i3", text: "chat" },
  ];
  const out = buildSortColumnsAnswerColumns(columns, items, { i1: "c1", i2: "c2", i3: "c1" });
  assert(out.length === 2, "one group per column, in column order");
  assert(out[0].columnId === "c1" && out[0].label === "Animaux domestiques", "first group keeps the column's own id/label");
  assert(
    out[0].items.map((it) => it.id).join(",") === "i1,i3",
    "items are grouped under their assigned column, in the original item order"
  );
  assert(out[1].items.map((it) => it.id).join(",") === "i2", "second column gets only its own item");
}

{
  const columns = [{ id: "c1", label: "A" }];
  const out = buildSortColumnsAnswerColumns(columns, [{ id: "i1", text: "x" }], {});
  assert(out[0].items.length === 0, "an item with no (or not-yet-revealed) column assignment lands in no group, not a crash");
}

{
  assert(buildSortColumnsAnswerColumns([], [], {}).length === 0, "no columns -> no groups, not a crash");
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
} else {
  console.log("All format-reveal-answer tests passed.");
}
