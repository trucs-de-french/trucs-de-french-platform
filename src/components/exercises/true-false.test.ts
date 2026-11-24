// Немає тестового фреймворку в проєкті (package.json) — простий assert-
// скрипт, той самий принцип, що format-reveal-answer.test.ts.
// Запуск вручну: npx tsx src/components/exercises/true-false.test.ts
//
// Задача "highlight instead of text line" (true_false, owner report) —
// trueFalseOptionClass — чиста функція кольору кнопки Vrai/Faux,
// винесена з renderStatement (true-false.tsx), щоб практика могла
// викликати ту саму логіку без повного TrueFalseDetail. Головне
// правило тут — "не вдалося" видно одразу, "яка правильна" — ЛИШЕ
// після явного розкриття чи коли студент сам вгадав правильно.
import { trueFalseOptionClass } from "./true-false";

let failures = 0;
function assert(condition: boolean, label: string) {
  if (!condition) {
    failures++;
    console.error(`FAIL: ${label}`);
  }
}

const GREEN = "border-green-500 bg-green-50 text-green-900 dark:bg-green-950/30 dark:text-green-100";
const RED = "border-red-500 bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-100";
const NEUTRAL = "glass-answer-btn glass-answer-btn--neutral";

// --- idle (correctAnswer undefined, studentAnswer undefined/null — ще не
// перевірялось) -------------------------------------------------------

{
  assert(
    trueFalseOptionClass(true, false, undefined, undefined) === "glass-answer-btn",
    "idle, unselected option -> plain neutral button, not yet an answer-state color"
  );
  assert(
    trueFalseOptionClass(true, true, undefined, undefined) === "glass-answer-btn--selected",
    "idle, the selected option -> selected style, not a correctness color"
  );
}

// --- failed, NOT revealed (correctAnswer undefined, studentAnswer known) —
// the whole point of the bug fix: never leak which one is correct here ---

{
  assert(
    trueFalseOptionClass(true, false, undefined, true) === RED,
    "failed, not revealed: the student's own wrong pick (Vrai) is red"
  );
  assert(
    trueFalseOptionClass(false, false, undefined, true) === "glass-answer-btn",
    "failed, not revealed: the OTHER option never turns green — the correct answer is not leaked before reveal"
  );
}

// --- revealed (correctAnswer known) -----------------------------------

{
  assert(trueFalseOptionClass(true, false, true, false) === GREEN, "revealed: the correct option (Vrai) is green");
  assert(
    trueFalseOptionClass(false, false, true, false) === RED,
    "revealed: the student's wrong pick (Faux) is red even after reveal"
  );
}

{
  // Студент сам вгадав правильно — correctAnswer тут "відомий" (== той,
  // що студент обрав), без жодного окремого reveal-запиту.
  assert(trueFalseOptionClass(true, true, true, true) === GREEN, "correct guess: the chosen (and correct) option is green");
}

{
  // Розкрито, але студент узагалі не відповідав (studentAnswer: null) —
  // неправильна сторона лишається нейтральною, не червоною (нема чого
  // підсвічувати як "хибний вибір", бо вибору не було).
  assert(
    trueFalseOptionClass(false, false, true, null) === NEUTRAL,
    "revealed with no student answer at all: the non-correct option is plain neutral, not red"
  );
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
}
console.log("All true-false tests passed.");
