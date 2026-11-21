// Немає тестового фреймворку в проєкті (package.json) — простий assert-
// скрипт, той самий принцип, що format-reveal-answer.test.ts.
// Запуск вручну: npx tsx src/lib/exercises/error-review.test.ts
import { idsToClearAfterMistake, WHOLE_TASK_ITEM_ID, mistakeItemIds } from "./error-review";

let failures = 0;
function assert(condition: boolean, label: string) {
  if (!condition) {
    failures++;
    console.error(`FAIL: ${label}`);
  }
}

// --- idsToClearAfterMistake (progress.ts: recordTaskAttempt, 0071 fix) ----

{
  const detail = {
    statements: [
      { id: "a", isCorrect: true },
      { id: "b", isCorrect: false },
      { id: "c", isCorrect: false },
      { id: "d", isCorrect: true },
    ],
  };
  const out = idsToClearAfterMistake("true_false", detail, false);
  assert([...out].sort().join(",") === "b,c", "items-mode true_false with two wrong statements returns exactly those two ids");
}

{
  const detail = {
    statements: [
      { id: "a", isCorrect: true },
      { id: "b", isCorrect: true },
    ],
  };
  const out = idsToClearAfterMistake("true_false", detail, true);
  assert(out.length === 0, "a fully correct items-mode attempt returns no ids to clear");
}

{
  const out = idsToClearAfterMistake("reorder", {}, false);
  assert(out.length === 1 && out[0] === WHOLE_TASK_ITEM_ID, "a whole-mode type with !correct returns the whole-task id");
}

{
  const out = idsToClearAfterMistake("reorder", {}, true);
  assert(out.length === 0, "a whole-mode type with correct returns no ids to clear");
}

{
  const outWrong = idsToClearAfterMistake("essay_check", {}, false);
  const outCorrect = idsToClearAfterMistake("essay_check", {}, true);
  assert(outWrong.length === 0, "a type that is neither items- nor whole-mode (essay_check, excluded) returns no ids when wrong");
  assert(outCorrect.length === 0, "a type that is neither items- nor whole-mode returns no ids when correct");
}

{
  const detail = {
    statements: [
      { id: "x", isCorrect: false },
      { id: "y", isCorrect: false },
      { id: "z", isCorrect: false },
    ],
  };
  const out = idsToClearAfterMistake("true_false", detail, false);
  assert(new Set(out).size === out.length, "returned ids are unique (no id appears twice) for a normal, well-formed detail");
}

{
  // Той самий id, що aggregateWrongItems/mistakeItemIds уже використовує —
  // idsToClearAfterMistake не вигадує власну схему ідентифікаторів.
  const detail = {
    statements: [
      { id: "a", isCorrect: true },
      { id: "b", isCorrect: false },
    ],
  };
  const fromClear = idsToClearAfterMistake("true_false", detail, false);
  const fromMistakeItemIds = mistakeItemIds("true_false", detail) ?? [];
  assert(
    [...fromClear].sort().join(",") === [...fromMistakeItemIds].sort().join(","),
    "idsToClearAfterMistake for items-mode uses the exact same ids as mistakeItemIds/aggregateWrongItems"
  );
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
}
console.log("All error-review tests passed.");
