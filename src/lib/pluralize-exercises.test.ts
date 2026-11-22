// Немає тестового фреймворку в проєкті (package.json) — простий assert-
// скрипт, той самий принцип, що format-reveal-answer.test.ts.
// Запуск вручну: npx tsx src/lib/pluralize-exercises.test.ts
import { pluralizeExercisesAccusative, pluralizeExercisesNominative } from "./pluralize-exercises";

let failures = 0;
function assert(condition: boolean, label: string) {
  if (!condition) {
    failures++;
    console.error(`FAIL: ${label}`);
  }
}

// --- pluralizeExercisesNominative ("Залишилось N вправ", mistakes page) ---

assert(pluralizeExercisesNominative(1) === "вправа", "1 -> вправа");
assert(pluralizeExercisesNominative(21) === "вправа", "21 -> вправа (mod10=1, mod100!=11)");
assert(pluralizeExercisesNominative(2) === "вправи", "2 -> вправи");
assert(pluralizeExercisesNominative(3) === "вправи", "3 -> вправи");
assert(pluralizeExercisesNominative(4) === "вправи", "4 -> вправи");
assert(pluralizeExercisesNominative(24) === "вправи", "24 -> вправи (mod10=4, mod100=24)");
assert(pluralizeExercisesNominative(5) === "вправ", "5 -> вправ");
assert(pluralizeExercisesNominative(0) === "вправ", "0 -> вправ");
assert(pluralizeExercisesNominative(11) === "вправ", "11 -> вправ (mod10=1 but mod100=11, teens exception)");
assert(pluralizeExercisesNominative(12) === "вправ", "12 -> вправ (mod10=2 but mod100=12, teens exception)");
assert(pluralizeExercisesNominative(14) === "вправ", "14 -> вправ (mod10=4 but mod100=14, teens exception)");

// --- pluralizeExercisesAccusative stays unchanged (regression) -------------

assert(pluralizeExercisesAccusative(1) === "вправу", "accusative 1 -> вправу (unchanged by this task)");
assert(pluralizeExercisesAccusative(2) === "вправи", "accusative 2 -> вправи");
assert(pluralizeExercisesAccusative(5) === "вправ", "accusative 5 -> вправ");

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
}
console.log("All pluralize-exercises tests passed.");
