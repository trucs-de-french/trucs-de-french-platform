// Немає тестового фреймворку в проєкті (package.json) — простий assert-
// скрипт, той самий принцип, що format-reveal-answer.test.ts.
// Запуск вручну: npx tsx src/lib/exercises/error-review.test.ts
import {
  idsToClearAfterMistake,
  WHOLE_TASK_ITEM_ID,
  mistakeItemIds,
  buildErrorReviewEntry,
  deriveMistakesChips,
  shouldRenderWrapperHeader,
  confirmedSolvedBlankIds,
  shouldAutoReveal,
  shouldShowAttemptFooter,
  aggregateWrongItems,
} from "./error-review";

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

// --- buildErrorReviewEntry.remainingItemIds (scene-error-review.ts matching
// fix, owner report "un formulaire"/"couramment" напіввирішені): the matching
// config scoped to remainingItemIds must be "frozen snapshot of wrong pairs
// at open time MINUS already corrected ones" — this is exactly wrongItemIds
// minus correctedItemIds, which buildErrorReviewEntry already computes as
// remainingItemIds. 14 wrong pairs, 2 already corrected -> 12 remaining. ----

{
  const pairIds = Array.from({ length: 14 }, (_, i) => `pair-${i}`);
  const detail = { pairPoints: pairIds.map((id) => ({ id, isCorrect: false })) };
  const correctedItemIds = ["pair-0", "pair-1"];
  const entry = buildErrorReviewEntry({
    taskId: "t1",
    taskType: "matching",
    mistakeRows: [{ createdAt: "2026-01-01T00:00:00Z", detail }],
    correctedItemIds,
    failedAttempts: {},
  });
  assert(entry.wrongItemIds.length === 14, "all 14 pairs are wrong (none correct in the mistake row)");
  assert(
    [...entry.remainingItemIds].sort().join(",") ===
      pairIds.filter((id) => !correctedItemIds.includes(id)).sort().join(","),
    "remainingItemIds is exactly wrongItemIds minus correctedItemIds: 14 wrong minus 2 corrected leaves the other 12"
  );
  assert(entry.remainingItemIds.length === 12, "14 wrong with 2 corrected leaves 12 remaining");
  assert(entry.status === "partial", "some corrected, some remaining -> status partial, not done");
}

// --- deriveMistakesChips (mistakes page scene-mode exercise switcher) -----

{
  // B повністю зникла з liveEntries (виправлена, score 100%) — "fixed",
  // хоч capturedOrder і далі знає про неї (стабільний порядок/номер).
  const out = deriveMistakesChips(
    ["a", "b", "c"],
    [
      { taskId: "a", status: "partial" },
      { taskId: "c", status: "done" },
    ],
    null
  );
  assert(out.length === 3, "chips keep the full captured order, even for a task missing from liveEntries");
  assert(out[0].index === 1 && out[0].status === "unfixed", "a: present and not done -> unfixed, index 1");
  assert(out[1].index === 2 && out[1].status === "fixed", "b: absent from liveEntries entirely -> fixed, index 2");
  assert(out[2].index === 3 && out[2].status === "fixed", "c: present but status done -> fixed, index 3");
}

{
  // activeTaskId має пріоритет над "fixed" — студент дивиться на задачу,
  // яку щойно сам довиправив.
  const out = deriveMistakesChips(["a", "b"], [{ taskId: "a", status: "done" }], "a");
  assert(out[0].status === "current", "the active task shows as current even if its own status is already done");
  assert(out[1].status === "fixed", "a non-active task absent from liveEntries is still fixed");
}

{
  const out = deriveMistakesChips([], [], null);
  assert(out.length === 0, "an empty captured order produces no chips, not a crash");
}

// --- shouldRenderWrapperHeader (ErrorReviewPractice — "duplicate
// instruction header" bug: fill_blank/sort_columns/checkbox_grid/
// chronological_order already draw TaskPanelHeader themselves in every
// flow, the wrapper must never add a second one) ---------------------

{
  // "always": own header in both flows, every flow -> wrapper skips.
  const alwaysOwnHeader = ["fill_blank", "sort_columns", "checkbox_grid", "chronological_order"];
  for (const type of alwaysOwnHeader) {
    assert(shouldRenderWrapperHeader(type, "flat") === false, `${type}: wrapper header is skipped in flat flow (own header always renders)`);
    assert(shouldRenderWrapperHeader(type, "scene") === false, `${type}: wrapper header is skipped in scene flow (own header always renders)`);
  }
}

{
  // "sceneOnly": own header only when isPractice && isSceneMode -> wrapper
  // renders in flat, skips in scene.
  const sceneOnlyOwnHeader = ["letter_rearrangement", "letter_gaps", "matching", "table_fill"];
  for (const type of sceneOnlyOwnHeader) {
    assert(shouldRenderWrapperHeader(type, "flat") === true, `${type}: wrapper header renders in flat flow (no own header outside scene mode)`);
    assert(shouldRenderWrapperHeader(type, "scene") === false, `${type}: wrapper header is skipped in scene flow (own header already there)`);
  }
}

{
  // the remaining 7 types never draw their own header in practice
  // (isPractice early-return with no TaskPanelHeader at all) -> wrapper
  // always renders, in both flows.
  const neverOwnHeader = [
    "multiple_choice",
    "true_false",
    "word_choice",
    "listening",
    "reorder",
    "drag_drop",
    "image_match",
  ];
  for (const type of neverOwnHeader) {
    assert(shouldRenderWrapperHeader(type, "flat") === true, `${type}: wrapper header renders in flat flow`);
    assert(shouldRenderWrapperHeader(type, "scene") === true, `${type}: wrapper header renders in scene flow`);
  }
}

// --- confirmedSolvedBlankIds (fill_blank practice — "show solved words
// instead of dashed dots": which blank ids are safe to reveal as plain
// text, never the wrong/still-unsolved ones) ---------------------------

{
  // 4-blank sentence, blank "1" is still wrong (in remainingItemIds) —
  // every other blank (never wrong, or wrong-but-corrected) is solved.
  const out = confirmedSolvedBlankIds(4, ["1", "2"], ["1"]);
  assert(
    [...out].sort().join(",") === "0,2,3",
    "not in wrongItemIds (0, 3) or wrong-but-corrected (2) are solved; still-wrong (1) is not"
  );
}

{
  // wrongItemIds is empty — this is intentionally ambiguous upstream
  // (aggregateWrongItems returns [] both when every blank was correct on
  // the latest valid attempt, AND when no valid attempt covering the
  // current template exists at all, e.g. the teacher changed the blank
  // count after every past submission). Without a way to tell those
  // apart, the function takes the SAFE reading of an empty wrongItemIds —
  // reveal nothing — rather than guessing that an empty list means
  // "everything is confirmed correct".
  const out = confirmedSolvedBlankIds(3, [], []);
  assert(out.length === 0, "empty wrongItemIds reveals nothing — no confirmed signal to act on, not even blank 0");
}

{
  // Every blank is still wrong — none solved.
  const out = confirmedSolvedBlankIds(2, ["0", "1"], ["0", "1"]);
  assert(out.length === 0, "no blank is solved while all of them remain wrong");
}

{
  const out = confirmedSolvedBlankIds(0, [], []);
  assert(out.length === 0, "zero blanks never produces a solved id");
}

// --- shouldAutoReveal / shouldShowAttemptFooter (задача "unify attempt/
// reveal behaviour" — product decision: practice NEVER auto-reveals the
// answer, in either flow; a decision point important enough to pin down
// with a test, even though the function itself takes no arguments) ------

{
  assert(shouldAutoReveal() === false, "auto-reveal must never happen, in either flow");
}

{
  assert(
    shouldShowAttemptFooter(false, undefined) === true,
    "footer shows after a wrong attempt that is not yet revealed"
  );
}

{
  assert(
    shouldShowAttemptFooter(false, ["chien"]) === false,
    "footer hides once the item is revealed, even if the last attempt was wrong"
  );
}

{
  assert(shouldShowAttemptFooter(true, undefined) === false, "footer never shows for a correct item");
}

{
  assert(shouldShowAttemptFooter(undefined, undefined) === false, "footer never shows before any attempt");
}

// --- aggregateWrongItems: "unanswered items from unattempted blocks never
// reach mistakes" (bug fix) — an item the student never touched in ANY
// historical mistakes row must count as wrong, not silently vanish. -------

// letter_gaps: block 1 (words 0-2) answered, block 2 (words 3-4) never
// attempted at all (null -> studentLetters: [] in every row that exists).
{
  const config = { words: [{}, {}, {}, {}, {}] };
  const detail = {
    words: [
      { studentLetters: ["x"], correctLetters: ["a"], isCorrect: false }, // wrong, in scope
      { studentLetters: ["y"], correctLetters: ["b"], isCorrect: false }, // wrong, in scope
      { studentLetters: ["c"], correctLetters: ["c"], isCorrect: true }, // correct, in scope
      { studentLetters: [], correctLetters: ["d"], isCorrect: false }, // never attempted (block 2)
      { studentLetters: [], correctLetters: ["e"], isCorrect: false }, // never attempted (block 2)
    ],
  };
  const out = aggregateWrongItems([{ createdAt: "2026-01-01T00:00:00Z", detail }], "letter_gaps", config);
  assert(
    [...out].sort().join(",") === "0,1,3,4",
    "letter_gaps: block 1's wrong words AND block 2's never-attempted words are all wrong; the correct word 2 is not"
  );
}

// letter_gaps: fully correct (all in scope, all correct) -> zero mistakes.
{
  const config = { words: [{}, {}, {}] };
  const detail = {
    words: [
      { studentLetters: ["a"], correctLetters: ["a"], isCorrect: true },
      { studentLetters: ["b"], correctLetters: ["b"], isCorrect: true },
      { studentLetters: ["c"], correctLetters: ["c"], isCorrect: true },
    ],
  };
  const out = aggregateWrongItems([{ createdAt: "2026-01-01T00:00:00Z", detail }], "letter_gaps", config);
  assert(out.length === 0, "letter_gaps: a fully correct submission of every word gives zero mistakes");
}

// letter_gaps: fully unanswered — no mistakes row exists at all (the task
// was never submitted even once), but the task's own word count is known.
{
  const config = { words: [{}, {}, {}] };
  const out = aggregateWrongItems([], "letter_gaps", config);
  assert(
    [...out].sort().join(",") === "0,1,2",
    "letter_gaps: with no mistakes row at all, every configured word counts as wrong, not zero"
  );
}

// letter_gaps: partially filled word (some letters typed, some left empty,
// but the array is dense/full-length — the real shape letter-gaps.tsx always
// sends for an ATTEMPTED word) stays wrong via the normal per-row path, not
// the new fallback — the fix must not change this already-correct case.
{
  const config = { words: [{}] };
  const detail = {
    words: [{ studentLetters: ["a", ""], correctLetters: ["a", "b"], isCorrect: false }],
  };
  const out = aggregateWrongItems([{ createdAt: "2026-01-01T00:00:00Z", detail }], "letter_gaps", config);
  assert([...out].join(",") === "0", "letter_gaps: a partially filled (attempted) word is still wrong, as before");
}

// letter_rearrangement: block 2 never attempted (inScope: false) is wrong,
// same shape as letter_gaps but via the explicit inScope field.
{
  const config = { words: [{}, {}] };
  const detail = {
    words: [
      { letters: [], isCorrect: true, inScope: true },
      { letters: [], isCorrect: false, inScope: false },
    ],
  };
  const out = aggregateWrongItems([{ createdAt: "2026-01-01T00:00:00Z", detail }], "letter_rearrangement", config);
  assert(
    [...out].join(",") === "1",
    "letter_rearrangement: the never-attempted word (inScope: false) counts as wrong"
  );
}

// multiple_choice: item "b" never answered in any row -> omitted from every
// row's detail.items entirely (gradeMultipleChoice's own scoping) -> must
// still end up wrong via the config-aware fallback.
{
  const config = { items: [{ id: "a" }, { id: "b" }] };
  const detail = { items: [{ id: "a", options: [{ correct: true, selected: false }] }] };
  const out = aggregateWrongItems([{ createdAt: "2026-01-01T00:00:00Z", detail }], "multiple_choice", config);
  assert(
    [...out].sort().join(",") === "a,b",
    "multiple_choice: item a is wrong as answered, item b (never answered) is also wrong"
  );
}

// true_false: statement "b" never answered.
{
  const config = { statements: [{ id: "a" }, { id: "b" }] };
  const detail = { statements: [{ id: "a", isCorrect: false }] };
  const out = aggregateWrongItems([{ createdAt: "2026-01-01T00:00:00Z", detail }], "true_false", config);
  assert([...out].sort().join(",") === "a,b", "true_false: the never-answered statement b is also wrong");
}

// word_choice: sentence "b" never answered.
{
  const config = { sentences: [{ id: "a" }, { id: "b" }] };
  const detail = { sentences: [{ id: "a", isCorrect: false }] };
  const out = aggregateWrongItems([{ createdAt: "2026-01-01T00:00:00Z", detail }], "word_choice", config);
  assert([...out].sort().join(",") === "a,b", "word_choice: the never-answered sentence b is also wrong");
}

// matching: pair "p2" never answered (gradeMatching's completePairs omits
// unanswered lefts from pairPoints entirely).
{
  const config = {
    pairs: [
      { id: "p1", left: "chat", right: "cat" },
      { id: "p2", left: "chien", right: "dog" },
    ],
  };
  const detail = { pairPoints: [{ id: "p1", isCorrect: false }] };
  const out = aggregateWrongItems([{ createdAt: "2026-01-01T00:00:00Z", detail }], "matching", config);
  assert([...out].sort().join(",") === "p1,p2", "matching: the never-answered pair p2 is also wrong");
}

// table_fill: row "r2" never answered (gradeTableFill's answeredRowIds
// omits unanswered rows from blanks entirely).
{
  const config = {
    rows: [
      { id: "r1", left: "a", right: "1" },
      { id: "r2", left: "b", right: "2" },
    ],
  };
  const detail = { blanks: [{ rowId: "r1", isCorrect: false }] };
  const out = aggregateWrongItems([{ createdAt: "2026-01-01T00:00:00Z", detail }], "table_fill", config);
  assert([...out].sort().join(",") === "r1,r2", "table_fill: the never-answered row r2 is also wrong");
}

// Confirms the legitimate purpose of the scope check is preserved: a NEWER
// row that only covers block 1 must not override an OLDER row where block 2
// was genuinely attempted and fixed — the fallback must only add ids never
// seen by ANY row, not let an unscoped newer row shadow a scoped older one.
{
  const config = { words: [{}, {}] };
  const olderRowBlock2Fixed = {
    words: [
      { studentLetters: [], correctLetters: ["a"], isCorrect: false }, // block 1, not this row's concern
      { studentLetters: ["b"], correctLetters: ["b"], isCorrect: true }, // block 2, fixed here
    ],
  };
  const newerRowBlock1Only = {
    words: [
      { studentLetters: ["x"], correctLetters: ["a"], isCorrect: false }, // block 1, still wrong
      { studentLetters: [], correctLetters: ["b"], isCorrect: false }, // block 2, not attempted THIS time
    ],
  };
  const out = aggregateWrongItems(
    [
      { createdAt: "2026-01-01T00:00:00Z", detail: olderRowBlock2Fixed },
      { createdAt: "2026-01-02T00:00:00Z", detail: newerRowBlock1Only },
    ],
    "letter_gaps",
    config
  );
  assert(
    [...out].join(",") === "0",
    "letter_gaps: word 1 was genuinely fixed in an older row and must stay out of the wrong set, even though the newest row didn't re-cover it"
  );
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
}
console.log("All error-review tests passed.");
