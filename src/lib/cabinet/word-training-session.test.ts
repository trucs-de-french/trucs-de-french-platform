// Немає тестового фреймворку в проєкті (package.json) — простий assert-
// скрипт, той самий принцип, що src/lib/exercises/format-points.test.ts.
// Запуск вручну: npx tsx src/lib/cabinet/word-training-session.test.ts
import {
  buildChoiceOptions,
  buildGapOptions,
  buildSession,
  cardsEligible,
  findGapMatch,
  scrambleWord,
  unscrambleEligible,
  type SessionWord,
} from "./word-training-session";

let failures = 0;
function assert(condition: boolean, label: string) {
  if (!condition) {
    failures++;
    console.error(`FAIL ${label}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function word(partial: Partial<SessionWord> & { id: string; word: string }): SessionWord {
  return { translation: null, partOfSpeech: null, contextFr: null, contextUk: null, ...partial };
}

// --- cardsEligible --------------------------------------------------
assert(cardsEligible(word({ id: "1", word: "chat", translation: "cat" })), "cardsEligible: has translation");
assert(!cardsEligible(word({ id: "1", word: "chat", translation: "" })), "cardsEligible: empty translation");
assert(!cardsEligible(word({ id: "1", word: "chat", translation: null })), "cardsEligible: null translation");

// --- buildChoiceOptions ----------------------------------------------
{
  const target = word({ id: "1", word: "chat", translation: "cat", partOfSpeech: "nom" });
  const pool = [
    target,
    word({ id: "2", word: "chien", translation: "dog", partOfSpeech: "nom" }),
    word({ id: "3", word: "souris", translation: "mouse", partOfSpeech: "nom" }),
    word({ id: "4", word: "table", translation: "table", partOfSpeech: "nom" }),
    word({ id: "5", word: "courir", translation: "to run", partOfSpeech: "verbe" }),
  ];
  const options = buildChoiceOptions(target, pool, seededRng(1));
  assert(!!options && options.includes("cat"), "buildChoiceOptions: includes correct answer");
  assert(!!options && options.length === 4, "buildChoiceOptions: 4 options when enough distractors exist");

  const onlyOne = buildChoiceOptions(target, [target, word({ id: "2", word: "chien", translation: "dog" })], seededRng(2));
  assert(!!onlyOne && onlyOne.length === 2, "buildChoiceOptions: 2 options with only 1 distractor available");

  const none = buildChoiceOptions(target, [target], seededRng(3));
  assert(none === null, "buildChoiceOptions: ineligible with zero distractors");
}

// --- unscrambleEligible ------------------------------------------------
assert(unscrambleEligible(word({ id: "1", word: "maison" })) === "maison", "unscrambleEligible: plain word kept as-is");
assert(
  unscrambleEligible(word({ id: "1", word: "pomme de terre" })) === null,
  "unscrambleEligible: multi-word phrase ineligible"
);
assert(unscrambleEligible(word({ id: "1", word: "un chat" })) === "chat", "unscrambleEligible: strips leading article");
assert(unscrambleEligible(word({ id: "1", word: "qu'il" })) === null, "unscrambleEligible: apostrophe ineligible");
assert(unscrambleEligible(word({ id: "1", word: "vas-y" })) === null, "unscrambleEligible: hyphen ineligible");
assert(unscrambleEligible(word({ id: "1", word: "va" })) === null, "unscrambleEligible: too short (<4)");
assert(
  unscrambleEligible(word({ id: "1", word: "anticonstitutionnel" })) === null,
  "unscrambleEligible: too long (>14)"
);

// --- scrambleWord -------------------------------------------------
{
  const scrambled = scrambleWord("maison", seededRng(4));
  assert(scrambled.join("").length === 6, "scrambleWord: keeps all letters");
  assert(scrambled.join("") !== "maison", "scrambleWord: differs from original order");
  assert([...scrambled].sort().join("") === [..."maison"].sort().join(""), "scrambleWord: same multiset of letters");
}

// --- findGapMatch -------------------------------------------------
{
  const w = word({ id: "1", word: "un chat", contextFr: "Le chat dort sur le canapé." });
  const match = findGapMatch(w);
  assert(!!match && match.surface === "chat", "findGapMatch: finds article-less form in sentence");
}
{
  const w = word({ id: "1", word: "manger", contextFr: "Elle mangeait une pomme hier." });
  const match = findGapMatch(w);
  assert(!!match && match.surface === "mangeait", "findGapMatch: finds a >=4-letter-stem form (mangeait ~ manger)");
}
{
  const w = word({ id: "1", word: "chat", contextFr: "Il fait beau aujourd'hui." });
  assert(findGapMatch(w) === null, "findGapMatch: no match returns null");
}
{
  // accent/case-insensitive: "École" vs "ecole"
  const w = word({ id: "1", word: "ecole", contextFr: "L'École est fermée." });
  const match = findGapMatch(w);
  assert(!!match && match.surface === "École", "findGapMatch: case/accent-insensitive match");
}

// --- buildGapOptions ----------------------------------------------
{
  const target = word({ id: "1", word: "chat", partOfSpeech: "nom" });
  const pool = [target, word({ id: "2", word: "chien", partOfSpeech: "nom" }), word({ id: "3", word: "table", partOfSpeech: "nom" })];
  const options = buildGapOptions("chat", target, pool, seededRng(5));
  assert(!!options && options.includes("chat") && options.length === 3, "buildGapOptions: correct + available distractors");

  const none = buildGapOptions("chat", target, [target], seededRng(6));
  assert(none === null, "buildGapOptions: ineligible with zero other words");
}

// --- buildSession -----------------------------------------------------
{
  const words: SessionWord[] = [
    word({ id: "1", word: "un chat", translation: "cat", partOfSpeech: "nom", contextFr: "Le chat dort." }),
    word({ id: "2", word: "chien", translation: "dog", partOfSpeech: "nom" }),
    word({ id: "3", word: "qu'il", translation: null }), // ineligible for everything except nothing — pure skip test
  ];
  const { questions, skippedCount } = buildSession(words, ["cards", "choice", "unscramble", "gap"], seededRng(7));
  assert(questions.length === 2, "buildSession: one question per eligible word");
  assert(skippedCount === 1, "buildSession: skips the fully-ineligible word");
  assert(
    questions.every((q) => words.some((w) => w.id === q.savedWordId)),
    "buildSession: every question maps back to a real word"
  );
}
{
  const words: SessionWord[] = [word({ id: "1", word: "maison", translation: null })];
  const { questions, skippedCount } = buildSession(words, ["choice"], seededRng(8));
  assert(questions.length === 0 && skippedCount === 1, "buildSession: skips when enabled type is ineligible for the word");
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exitCode = 1;
} else {
  console.log("\nAll tests passed");
}
