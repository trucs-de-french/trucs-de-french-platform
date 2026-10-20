// Немає тестового фреймворку в проєкті (package.json) — простий assert-
// скрипт, запускається вручну: npx tsx src/lib/exercises/syllable-split.test.ts
import { splitIntoSyllableChunks } from "./syllable-split";

let failures = 0;
function assertEqual(actual: string[], expected: string[], label: string) {
  const ok = actual.length === expected.length && actual.every((c, i) => c === expected[i]);
  if (!ok) {
    failures++;
    console.error(`FAIL ${label}: expected [${expected.join(",")}], got [${actual.join(",")}]`);
  } else {
    console.log(`ok   ${label}: [${actual.join(",")}]`);
  }
}

assertEqual(splitIntoSyllableChunks("ingratitude"), ["in", "gra", "ti", "tude"], "ingratitude");
assertEqual(splitIntoSyllableChunks("orphelin"), ["or", "phe", "lin"], "orphelin");
assertEqual(splitIntoSyllableChunks("formulaire"), ["for", "mu", "laire"], "formulaire");
assertEqual(splitIntoSyllableChunks("conduire"), ["con", "duire"], "conduire");
assertEqual(splitIntoSyllableChunks("bisou"), ["bi", "sou"], "bisou");
assertEqual(splitIntoSyllableChunks("baiser"), ["bai", "ser"], "baiser");
assertEqual(splitIntoSyllableChunks("chéri"), ["ché", "ri"], "chéri");
assertEqual(splitIntoSyllableChunks("détester"), ["dé", "tes", "ter"], "détester");

// Короткі слова (<4 літер) — один фрагмент, без розбиття.
assertEqual(splitIntoSyllableChunks("un"), ["un"], "un (short)");
assertEqual(splitIntoSyllableChunks("se"), ["se"], "se (short)");

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll splitIntoSyllableChunks assertions passed");
