// Немає тестового фреймворку в проєкті (package.json) — простий assert-
// скрипт, той самий принцип, що format-reveal-answer.test.ts.
// Запуск вручну: npx tsx src/lib/exercises/practice-partial-answer.test.ts
//
// Задача "check-кнопка практики завжди активна" — практика дозволяє
// надіслати "Перевірити" з НУЛЬОВОЮ чи ЧАСТКОВОЮ відповіддю (кнопка більше
// не блокується кількістю заповнених елементів, components/exercises/*).
// Цей тест доводить, що саме gradeAnswer() (єдина й для практики, і для
// звичайної перевірки логіка) приймає такі відповіді без винятку і НІКОЛИ
// не зараховує неторкнутий елемент як правильний — для всіх типів, де
// JSX-гейт на check-кнопці був прибраний.
import { gradeAnswer } from "./grade";

let failures = 0;
function assert(condition: boolean, label: string) {
  if (!condition) {
    failures++;
    console.error(`FAIL: ${label}`);
  }
}

function assertNoThrow(label: string, fn: () => void) {
  try {
    fn();
  } catch (e) {
    failures++;
    console.error(`FAIL (threw): ${label} — ${e}`);
  }
}

// --- multiple_choice --------------------------------------------------------

{
  const config = {
    display: "buttons",
    items: [
      { id: "i1", sentence: "S1", options: [{ id: "o1", text: "A", correct: true }, { id: "o2", text: "B", correct: false }] },
      { id: "i2", sentence: "S2", options: [{ id: "o1", text: "A", correct: true }, { id: "o2", text: "B", correct: false }] },
    ],
  };
  assertNoThrow("multiple_choice, zero answers", () => {
    const r = gradeAnswer("multiple_choice", config, [
      { itemId: "i1", selected: [] },
      { itemId: "i2", selected: [] },
    ]);
    assert(r.correct === false, "multiple_choice: zero answers never grades correct");
  });
  assertNoThrow("multiple_choice, partial answers", () => {
    const r = gradeAnswer("multiple_choice", config, [
      { itemId: "i1", selected: ["o1"] },
      { itemId: "i2", selected: [] },
    ]);
    assert(r.correct === false, "multiple_choice: one unanswered item keeps the whole task incorrect");
  });
}

// --- true_false --------------------------------------------------------------

{
  const config = {
    statements: [
      { id: "s1", text: "T1", answer: true },
      { id: "s2", text: "T2", answer: false },
    ],
  };
  assertNoThrow("true_false, zero answers (value undefined, as the unanswered client payload sends)", () => {
    const r = gradeAnswer("true_false", config, [
      { id: "s1", value: undefined },
      { id: "s2", value: undefined },
    ]);
    assert(r.correct === false, "true_false: zero answers never grades correct");
  });
  assertNoThrow("true_false, partial answers", () => {
    const r = gradeAnswer("true_false", config, [
      { id: "s1", value: true },
      { id: "s2", value: undefined },
    ]);
    assert(r.correct === false, "true_false: one unanswered statement keeps the whole task incorrect");
  });
}

// --- word_choice ---------------------------------------------------------------

{
  const config = {
    mode: "select",
    sentences: [
      { id: "se1", sentence: "S1", options: [{ id: "o1", text: "A", correct: true }, { id: "o2", text: "B", correct: false }] },
      { id: "se2", sentence: "S2", options: [{ id: "o1", text: "A", correct: true }, { id: "o2", text: "B", correct: false }] },
    ],
  };
  assertNoThrow("word_choice, zero answers", () => {
    const r = gradeAnswer("word_choice", config, [
      { sentenceId: "se1", selected: [] },
      { sentenceId: "se2", selected: [] },
    ]);
    assert(r.correct === false, "word_choice: zero answers never grades correct");
  });
  assertNoThrow("word_choice, partial answers", () => {
    const r = gradeAnswer("word_choice", config, [
      { sentenceId: "se1", selected: ["o1"] },
      { sentenceId: "se2", selected: [] },
    ]);
    assert(r.correct === false, "word_choice: one unanswered sentence keeps the whole task incorrect");
  });
}

// --- listening -------------------------------------------------------------------

{
  const config = {
    audioUrl: "x.mp3",
    questions: [
      { id: "q1", question: "Q1", options: [{ id: "o1", text: "Oui", correct: true }, { id: "o2", text: "Non", correct: false }] },
      { id: "q2", question: "Q2", options: [{ id: "o1", text: "Oui", correct: false }, { id: "o2", text: "Non", correct: true }] },
    ],
  };
  // listening.tsx submitPractice завжди шле ОДИН запис на питання (навіть
  // без вибору — optionId: undefined), ніколи порожній масив.
  assertNoThrow("listening, zero answers (optionId undefined)", () => {
    const r = gradeAnswer("listening", config, [
      { questionId: "q1", optionId: undefined },
      { questionId: "q2", optionId: undefined },
    ]);
    assert(r.correct === false, "listening: zero answers never grades correct");
  });
  assertNoThrow("listening, partial answers", () => {
    const r = gradeAnswer("listening", config, [
      { questionId: "q1", optionId: "o1" },
      { questionId: "q2", optionId: undefined },
    ]);
    assert(r.correct === false, "listening: one unanswered question keeps the whole task incorrect");
  });
}

// --- matching ----------------------------------------------------------------

{
  const config = {
    pairs: [
      { left: "l1", right: "r1" },
      { left: "l2", right: "r2" },
    ],
  };
  // matching.tsx submitPractice (флет-режим) просто пропускає незв'язані
  // left — надсилає масив КОРОТШИЙ за кількість пар, не null/"". matching —
  // items-режим (error-review.ts): і route.ts, і UI читають per-пару
  // detail.pairPoints[].isCorrect (за itemId), НЕ graded.correct на всю
  // відповідь (той прапор навмисно скоуплений на блок, matching-blocks.ts,
  // тож для порожньої відповіді він тривіально "true" — 0 з 0 пар — сам по
  // собі нічого не зараховує й ніде так не читається для цього типу).
  assertNoThrow("matching, zero answers (empty array)", () => {
    const r = gradeAnswer("matching", config, []);
    const detail = r.detail as { pairPoints: { id: string; isCorrect: boolean }[] };
    assert(
      detail.pairPoints.every((p) => !p.isCorrect),
      "matching: zero answers never mark any pair correct (route.ts per-itemId lookup)"
    );
  });
  assertNoThrow("matching, partial answers (one left omitted)", () => {
    const r = gradeAnswer("matching", config, [{ left: "l1", right: "r1" }]);
    const detail = r.detail as { pairPoints: { id: string; left: string; isCorrect: boolean }[] };
    const omitted = detail.pairPoints.find((p) => p.left === "l2");
    assert(omitted === undefined, "matching: an omitted left never appears in pairPoints (route.ts defaults it to correct:false)");
  });
}

// --- drag_drop -----------------------------------------------------------------

{
  const config = {
    sentences: [{ id: "d1", template: "Je {{vais}} au {{cinema}}." }],
    bank: ["vais", "cinema"],
  };
  assertNoThrow("drag_drop, zero answers (empty-string words)", () => {
    const r = gradeAnswer("drag_drop", config, [{ sentenceId: "d1", words: ["", ""], hintedWords: [] }]);
    assert(r.correct === false, "drag_drop: zero answers never grades correct");
  });
  assertNoThrow("drag_drop, partial answers (one blank left empty)", () => {
    const r = gradeAnswer("drag_drop", config, [{ sentenceId: "d1", words: ["vais", ""], hintedWords: [] }]);
    assert(r.correct === false, "drag_drop: one unfilled blank keeps the sentence incorrect");
  });
}

// --- image_match ---------------------------------------------------------------

{
  const config = {
    items: [
      { id: "im1", imageUrl: "u1", name: "chat" },
      { id: "im2", imageUrl: "u2", name: "chien" },
    ],
  };
  assertNoThrow("image_match, zero answers (empty-string names)", () => {
    const r = gradeAnswer("image_match", config, [
      { itemId: "im1", name: "" },
      { itemId: "im2", name: "" },
    ]);
    assert(r.correct === false, "image_match: zero answers never grades correct");
  });
  assertNoThrow("image_match, partial answers", () => {
    const r = gradeAnswer("image_match", config, [
      { itemId: "im1", name: "chat" },
      { itemId: "im2", name: "" },
    ]);
    assert(r.correct === false, "image_match: one unplaced item keeps the whole task incorrect");
  });
}

// --- fill_blank ------------------------------------------------------------------

{
  const config = { template: "Je {{vais}} au {{cinema}}." };
  assertNoThrow("fill_blank, zero answers (empty-string answers)", () => {
    const r = gradeAnswer("fill_blank", config, { answers: ["", ""], hintedBlanks: [] });
    assert(r.correct === false, "fill_blank: zero answers never grades correct");
  });
  assertNoThrow("fill_blank, partial answers (one blank left empty)", () => {
    const r = gradeAnswer("fill_blank", config, { answers: ["vais", ""], hintedBlanks: [] });
    assert(r.correct === false, "fill_blank: one unfilled blank keeps the whole task incorrect");
  });
}

// --- sort_columns ----------------------------------------------------------------

{
  const config = {
    columns: [{ id: "c1", label: "A" }, { id: "c2", label: "B" }],
    items: [
      { id: "it1", text: "T1", columnId: "c1" },
      { id: "it2", text: "T2", columnId: "c2" },
    ],
  };
  // sort-columns.tsx submitPractice шле columnId: "" для нерозкладеного
  // елемента (assignment[item.id] ?? "").
  assertNoThrow("sort_columns, zero answers (empty-string columnId)", () => {
    const r = gradeAnswer("sort_columns", config, [
      { itemId: "it1", columnId: "" },
      { itemId: "it2", columnId: "" },
    ]);
    assert(r.correct === false, "sort_columns: zero answers never grades correct");
  });
  assertNoThrow("sort_columns, partial answers (one item unplaced)", () => {
    const r = gradeAnswer("sort_columns", config, [
      { itemId: "it1", columnId: "c1" },
      { itemId: "it2", columnId: "" },
    ]);
    assert(r.correct === false, "sort_columns: one unplaced item keeps the whole task incorrect");
  });
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
}
console.log("All practice-partial-answer tests passed.");
