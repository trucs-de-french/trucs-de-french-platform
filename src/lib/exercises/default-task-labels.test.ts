// Немає тестового фреймворку в проєкті (package.json) — простий assert-
// скрипт, той самий принцип, що error-review.test.ts.
// Запуск вручну: npx tsx src/lib/exercises/default-task-labels.test.ts
import { poolIntruderCount } from "./default-task-labels";

let failures = 0;
function assert(condition: boolean, label: string) {
  if (!condition) {
    failures++;
    console.error(`FAIL: ${label}`);
  }
}

// --- poolIntruderCount (drag_drop/fill_blank word pool — "N intrus" pill:
// bank size minus the blanks that must be filled right now, never below 0)

{
  // Scene case: full bank, all blanks of the task.
  const out = poolIntruderCount(15, 10);
  assert(out === 5, "scene: 15-word bank, 10 blanks -> 5 intruders");
}

{
  // Practice case: filtered bank (filterWordBank already removed solved
  // blanks' words), only the still-remaining blanks — comes out equal to
  // the scene value for the same task when the bank covers every blank.
  const out = poolIntruderCount(7, 2);
  assert(out === 5, "practice: 7-word filtered bank, 2 remaining blanks -> 5 intruders, matching the scene value");
}

{
  // Zero case: bank exactly matches the number of blanks.
  const out = poolIntruderCount(10, 10);
  assert(out === 0, "bank size equal to blanks -> zero intruders");
}

{
  // More blanks than words: the bank is admin-authored and not guaranteed
  // to have an entry for every blank (it's an optional hint list) — must
  // clamp to 0, never return a negative count.
  const out = poolIntruderCount(3, 10);
  assert(out === 0, "fewer bank words than blanks -> clamped to 0, not negative");
}

{
  const out = poolIntruderCount(0, 0);
  assert(out === 0, "empty bank and no blanks -> zero");
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
}
console.log("All default-task-labels tests passed.");
