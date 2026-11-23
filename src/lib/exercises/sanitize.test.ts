// Немає тестового фреймворку в проєкті (package.json) — простий assert-
// скрипт, той самий принцип, що error-review.test.ts.
// Запуск вручну: npx tsx src/lib/exercises/sanitize.test.ts
import { filterWordBank } from "./sanitize";

let failures = 0;
function assert(condition: boolean, label: string) {
  if (!condition) {
    failures++;
    console.error(`FAIL: ${label}`);
  }
}

// --- filterWordBank (fill_blank wordBank / drag_drop bank — задача "pool
// shows only what's needed": remove one bank occurrence per excluded
// blank/sentence, keep genuine distractors and still-needed words) -----

{
  // Duplicates: bank has two "chien", only one blank needs it excluded —
  // exactly one copy removed, one remains.
  const out = filterWordBank(["chien", "chien", "chat"], [["chien"]]);
  assert(
    out.length === 2 && out.filter((w) => w === "chien").length === 1 && out.includes("chat"),
    "duplicates: only as many copies removed as excluded entries, the rest stays"
  );
}

{
  // Case differences: excluded variant "Chien" (as parsed from a
  // capitalised marker) must still match a lowercase bank entry.
  const out = filterWordBank(["chien", "chat"], [["Chien"]]);
  assert(!out.includes("chien") && out.includes("chat"), "case-insensitive match removes the right word");
}

{
  // Trimmed: stray whitespace in either side must not block the match.
  const out = filterWordBank([" chien ", "chat"], [["chien"]]);
  assert(out.length === 1 && out[0] === "chat", "trimmed match removes a word with surrounding whitespace");
}

{
  // Accepted variants: a blank accepts "chien" OR "chiot" — the bank only
  // has "chiot" (the second variant) — it must still be removed by
  // matching ANY of the blank's variants, not just the first.
  const out = filterWordBank(["chiot", "chat"], [["chien", "chiot"]]);
  assert(out.length === 1 && out[0] === "chat", "matches any accepted variant of the excluded blank, not only the first");
}

{
  // A solved/excluded word that also happens to be a genuine distractor:
  // bank has two "chien" (one is the real answer being excluded, one is
  // an unrelated distractor the teacher added) — only one is removed.
  const out = filterWordBank(["chien", "chien", "souris"], [["chien"]]);
  assert(
    out.filter((w) => w === "chien").length === 1,
    "a word that is both a solved answer and a coincidental distractor loses only one copy"
  );
}

{
  // Still-needed word untouched: two blanks need "chien" (one excluded,
  // one still part of the active practice) — removing the excluded one
  // must never remove the copy the still-needed blank relies on.
  const out = filterWordBank(["chien", "chien"], [["chien"]]);
  assert(out.length === 1 && out[0] === "chien", "the still-needed copy of a duplicated word survives");
}

{
  // Empty excluded list (confirmedSolvedBlankIds' fallback case, or a
  // drag_drop task where nothing is excluded) — bank returned unchanged,
  // same array values and order.
  const bank = ["chien", "chat", "souris"];
  const out = filterWordBank(bank, []);
  assert(out.join(",") === bank.join(","), "empty excluded list leaves the bank untouched (fallback case)");
}

{
  // No match found for an excluded entry (e.g. the teacher never put
  // that word in the bank at all) — nothing crashes, nothing else is
  // removed.
  const out = filterWordBank(["chat"], [["chien"]]);
  assert(out.length === 1 && out[0] === "chat", "an excluded variant with no bank match removes nothing");
}

{
  const out = filterWordBank([], [["chien"]]);
  assert(out.length === 0, "an empty bank stays empty");
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
}
console.log("All sanitize tests passed.");
