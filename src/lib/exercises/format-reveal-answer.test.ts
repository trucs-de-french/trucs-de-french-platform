// Немає тестового фреймворку в проєкті (package.json) — простий assert-
// скрипт, той самий принцип, що task-display-name.test.ts.
// Запуск вручну: npx tsx src/lib/exercises/format-reveal-answer.test.ts
import {
  buildGapRowsFromReveal,
  buildTableFillAnswerRowsFromReveal,
  buildMatchingPairRowsFromReveal,
  buildRevealedWordDetail,
  buildSortColumnsAnswerColumns,
  practiceOptionDetail,
  practiceRowCorrect,
  maskMissedCheckboxCells,
  normalizeGapBefore,
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

// --- practiceOptionDetail (задача "highlight instead of text line" —
// listening/multiple_choice/word_choice: та сама форма детейла, що
// звичайна вправа будує з gradeAnswer, лише з практики — головне
// правило перевіряється тут: ніколи не позначай correct:true на
// варіанті, якого студент НЕ обирав, доки відповідь не розкрита) ------

{
  const options = [{ id: "o1", text: "Oui" }, { id: "o2", text: "Non" }];
  assert(practiceOptionDetail(options, [], undefined, undefined) === undefined, "idle (never checked) -> no detail at all, nothing to highlight");
}

{
  const options = [{ id: "o1", text: "Oui" }, { id: "o2", text: "Non" }];
  const out = practiceOptionDetail(options, ["o1"], false, undefined)!;
  assert(out[0].selected === true && out[0].correct === false, "failed, not revealed: the student's own wrong pick is selected but NEVER correct:true");
  assert(out[1].selected === false && out[1].correct === false, "failed, not revealed: the actually-correct option stays correct:false too — not leaked");
}

{
  const options = [{ id: "o1", text: "Oui" }, { id: "o2", text: "Non" }];
  const out = practiceOptionDetail(options, ["o2"], true, undefined)!;
  assert(out[1].correct === true && out[1].selected === true, "correct guess, no reveal needed: the student's own (correct) pick shows correct:true");
  assert(out[0].correct === false, "the other, unselected option never becomes correct:true just because the student happened to be right");
}

{
  const options = [{ id: "o1", text: "Oui" }, { id: "o2", text: "Non" }];
  const out = practiceOptionDetail(options, ["o1"], false, ["Non"])!;
  assert(out[1].correct === true, "revealed: the actually-correct option (matched by text) is correct:true");
  assert(out[0].correct === false && out[0].selected === true, "revealed: the student's earlier wrong pick stays selected:true, correct:false (still shows red)");
}

{
  const options = [{ id: "o1", text: "chien" }];
  const out = practiceOptionDetail(options, [], false, ["chien"])!;
  assert(out[0].correct === true && out[0].selected === false, "revealed with no student selection at all: correct option still marked correct:true, not a crash");
}

// --- practiceRowCorrect (owner report: "multiple_choice dropdown painted
// an unanswered item green" — renderDropdownRow recomputed the row's
// whole-row color from itemDetail.options.every(o.correct===o.selected),
// which is vacuously true when the student selected nothing AND
// practiceOptionDetail's isCorrect===false branch forces correct:false on
// every option. This helper replaces that recomputation in practice: the
// row color comes straight from the already-gated server verdict
// (isCorrect) plus whether the live answer is actually non-empty, never
// from re-deriving "correctness" out of a synthetic per-option array.) ---

{
  assert(practiceRowCorrect(false, false) === false, "empty answer after a check -> red, never green");
}

{
  assert(
    practiceRowCorrect(true, false) === false,
    "stale correct result (e.g. from a prior attempt) with the live answer since cleared to empty -> red, not green"
  );
}

{
  assert(practiceRowCorrect(true, true) === true, "a real non-empty correct answer -> green");
}

{
  // Розкриття (practiceCheck.reveal) ніяк не впливає на isCorrect, яке
  // сюди передається — елемент потрапляє в reveal лише коли він і так
  // вже isCorrect===false (stillWrongIds), тож колір лишається тим самим
  // до й після відкриття тоглу "Відповідь".
  const beforeReveal = practiceRowCorrect(false, true);
  const afterReveal = practiceRowCorrect(false, true);
  assert(beforeReveal === false && afterReveal === false, "opening the answers toggle (reveal) never changes the row color");
}

{
  assert(practiceRowCorrect(undefined, false) === null, "before any check at all -> neutral, regardless of whether anything is selected");
  assert(practiceRowCorrect(undefined, true) === null, "before any check, even with a live selection already made -> still neutral");
}

// --- maskMissedCheckboxCells (checkbox_grid, owner report: "in-place
// marking instead of panel/pill" — the dashed 'missed correct answer'
// cell must never appear before the golden 'Відповідь' pill is pressed,
// since it reveals the answer on a plain failed check otherwise; the
// student's own correct/wrong ticks are never masked, they reveal
// nothing about what else was correct) ------------------------------

{
  const cells = [
    { rowId: "r1", columnId: "c1", studentChecked: true, correctChecked: true },
    { rowId: "r1", columnId: "c2", studentChecked: true, correctChecked: false },
    { rowId: "r2", columnId: "c1", studentChecked: false, correctChecked: true },
  ];
  const out = maskMissedCheckboxCells(cells, false);
  assert(out[0].correctChecked === true, "not revealed: the student's own correct tick still shows correct (no leak, it's their own answer)");
  assert(out[1].correctChecked === false, "not revealed: the student's own wrong tick stays wrong (no leak either)");
  assert(
    out[2].correctChecked === false,
    "not revealed: a cell the student never touched but WAS correct is masked to false — must not leak which cell was missed"
  );
}

{
  const cells = [{ rowId: "r1", columnId: "c1", studentChecked: false, correctChecked: true }];
  const out = maskMissedCheckboxCells(cells, true);
  assert(out[0].correctChecked === true, "revealed: the missed-correct cell is no longer masked, shows the dashed state");
}

{
  assert(maskMissedCheckboxCells([], false).length === 0, "no cells -> no crash");
}

// --- normalizeGapBefore (owner report: "du [lait] dans" had a visibly
// bigger gap on the left than the right — the fix removes the CSS
// margin entirely and normalizes the text instead, so both sides come
// from the SAME kind of space) --------------------------------------

{
  assert(normalizeGapBefore("boire du") === "boire du ", "a normal trailing word gets exactly one trailing space added");
}

{
  assert(
    normalizeGapBefore("boire du ") === "boire du ",
    "already exactly one trailing space stays exactly one — no doubling"
  );
}

{
  assert(
    normalizeGapBefore("boire du   ") === "boire du ",
    "multiple trailing spaces collapse to exactly one — this is what caused the old double-gap together with the CSS margin"
  );
}

{
  assert(normalizeGapBefore("voler ?") === "voler ? ", "no trailing space at all still gets exactly one added (the original zero-gap bug)");
}

{
  assert(normalizeGapBefore("") === "", "an empty 'before' (chip at the very start of the sentence) stays empty — no stray leading space/margin");
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
} else {
  console.log("All format-reveal-answer tests passed.");
}
