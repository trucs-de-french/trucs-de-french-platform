// Немає тестового фреймворку в проєкті (package.json) — простий assert-
// скрипт, той самий принцип, що format-reveal-answer.test.ts.
// Запуск вручну: npx tsx src/lib/exercises/error-review.test.ts
import {
  idsToClearAfterMistake,
  WHOLE_TASK_ITEM_ID,
  mistakeItemIds,
  buildErrorReviewEntry,
  deriveMistakesChips,
  isAllChipActive,
  shouldRenderWrapperHeader,
  confirmedSolvedBlankIds,
  shouldAutoReveal,
  shouldShowAttemptFooter,
  practiceAttemptFooterState,
  dotsFilledCount,
  aggregateWrongItems,
  stillWrongIds,
  maxFailedAttempts,
  pruneStaleResults,
  practiceAnswerForColor,
  derivePracticeItemStatus,
  shownPracticeItemIds,
  hasVisiblePracticeItems,
  prunePracticeResults,
  shouldShowRevealPill,
  reorderWordState,
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

{
  // Задача "chip row always visible" — у режимі списку (нічого не
  // відкрито) null activeTaskId вже й так означає "жоден номерний чип не
  // current" (перевірено вище) — тут окремо: саме ЖОДЕН чип не current,
  // щоб "Усі вправи" (isAllChipActive, рендериться поряд) лишався єдиним
  // активним.
  const out = deriveMistakesChips(["a", "b"], [{ taskId: "a", status: "partial" }], null);
  assert(out.every((c) => c.status !== "current"), "list mode (activeTaskId null): no numbered chip is ever current");
}

// --- isAllChipActive (mistakes page "Усі вправи" chip, scene mode) --------

{
  assert(isAllChipActive(null) === true, "list mode (no task open): the all-exercises chip is active");
  assert(isAllChipActive("a") === false, "single-exercise mode (task 'a' open): the all-exercises chip is not active");
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

// --- practiceAttemptFooterState / dotsFilledCount (задача "unify
// attempt/status footer" — PracticeAttemptFooter, practice-attempt-
// footer.tsx, reads this one discriminator instead of 15 separate
// ternaries) -----------------------------------------------------------

{
  assert(practiceAttemptFooterState(undefined, undefined) === "idle", "no attempt yet -> idle");
  assert(practiceAttemptFooterState(false, undefined) === "failed", "wrong, not revealed -> failed");
  assert(practiceAttemptFooterState(true, undefined) === "correct", "correct -> correct");
  assert(practiceAttemptFooterState(false, ["chien"]) === "revealed", "revealed wins over a wrong last attempt");
  assert(practiceAttemptFooterState(true, ["chien"]) === "revealed", "revealed wins even over a correct last attempt");
  assert(practiceAttemptFooterState(undefined, ["chien"]) === "revealed", "revealed wins even with no attempt recorded");
}

{
  assert(dotsFilledCount(0) === 0, "zero attempts -> zero filled dots");
  assert(dotsFilledCount(1) === 1, "one attempt -> one filled dot");
  assert(dotsFilledCount(3) === 3, "three attempts -> all three dots filled");
  assert(dotsFilledCount(7) === 3, "more than three attempts still caps at three dots, never overflows");
}

// --- pruneStaleResults (bug fix: "attempt footer disappears right after
// a failed check" — the inline error block's onlyItemIds is the LIVE
// entry.remainingItemIds, which gets a new array from every
// router.refresh() after practiceCheck.check()/reveal() (fired even for
// a WRONG answer) — not just when an item is fixed, but also whenever
// the server recomputes wrongItemIds in a different ORDER (newest
// mistake row first). The old code treated "the joined key string
// changed" as "wipe every local result", losing isCorrect:false for an
// item that is still wrong and still present, just reordered — this is
// the fix: only drop entries for ids that actually left the set.) ------

{
  const prev = { a: false, b: true, c: false };
  const out = pruneStaleResults(prev, ["c", "a", "b"]);
  assert(
    out.a === false && out.b === true && out.c === false,
    "a pure reorder of the SAME ids keeps every result exactly as it was — this is the regression: the footer must not disappear just because the server returned the same items in a different order"
  );
}

{
  const prev = { a: false, b: true };
  const out = pruneStaleResults(prev, ["a"]);
  assert(out.a === false, "a still-present id's result survives");
  assert(!("b" in out), "an id that dropped out of scope (fixed/no longer relevant) is removed, not kept stale");
}

{
  assert(Object.keys(pruneStaleResults({}, ["a", "b"])).length === 0, "nothing to prune from an empty result map, not a crash");
}

{
  assert(Object.keys(pruneStaleResults({ a: false }, [])).length === 0, "an empty current-ids list drops everything (the item is no longer in scope)");
}

// --- stillWrongIds / maxFailedAttempts (задача "replace red per-pair
// lines with collapsible answers panel" — спільні для matching/
// multiple_choice/word_choice/drag_drop/image_match/reorder/
// chronological_order/sort_columns/checkbox_grid: панель і лічильник
// показують лише елементи, що й досі неправильні, а крапки спроб
// рахують НАЙГІРШИЙ attempts серед саме цих елементів) ---------------------

{
  const out = stillWrongIds(
    ["a", "b", "c"],
    { a: false, b: true } // c: не перевірена взагалі (undefined)
  );
  assert(out.length === 1 && out[0] === "a", "only strictly-false lefts count as still wrong — correct (true) and never-checked (undefined) are excluded");
}

{
  assert(stillWrongIds([], {}).length === 0, "an empty leftItems list produces no wrong lefts, not a crash");
}

{
  // Виправлена пара (a: true тепер) зникає зі списку й лічильника — те
  // саме, що й вимога "When the student later fixes a pair, it is
  // removed from the panel list and from the counter".
  const before = stillWrongIds(["a", "b"], { a: false, b: false });
  const after = stillWrongIds(["a", "b"], { a: true, b: false });
  assert(before.length === 2, "both still wrong before the fix");
  assert(after.length === 1 && after[0] === "b", "the fixed pair drops out, the other stays");
}

{
  assert(
    maxFailedAttempts(["p1", "p2"], { p1: 1, p2: 3 }) === 3,
    "the footer dots/label use the WORST (max) attempts among the given ids, not the first or the sum"
  );
}

{
  assert(maxFailedAttempts([], { p1: 5 }) === 0, "no ids -> 0, never a crash or a stray value from an unrelated id");
}

{
  assert(maxFailedAttempts(["p1"], {}) === 0, "a missing attempts entry defaults to 0, not undefined/NaN");
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

// --- practiceAnswerForColor (owner report, true_false: "already shows
// red Vrai/Faux buttons... before 'Перевірити' was pressed" — the root
// cause was passing the student's live selection straight into the
// color function without first checking whether THIS session has
// actually graded the item; this is the exact gate that was missing) --

{
  assert(
    practiceAnswerForColor(undefined, true) === undefined,
    "not checked yet this session (isCorrect undefined) -> the live selection never reaches the color function, no matter what was clicked"
  );
}

{
  assert(
    practiceAnswerForColor(false, true) === true,
    "failed check this session -> the live answer is passed through for coloring (the student's own wrong pick turns red)"
  );
  assert(
    practiceAnswerForColor(true, true) === true,
    "correct check this session -> the live answer is passed through too (feeds the green highlight)"
  );
}

// --- "stay until next open" (owner report: a corrected item vanished
// from the practice list the instant router.refresh() returned a
// shorter remainingItemIds — the student never saw their own success).
// derivePracticeItemStatus/shownPracticeItemIds — the merge of snapshot
// ids + live remainingItemIds + this-window's own local results into
// per-item status/the shown list (requirement 10a). ---

{
  // corrected here stays (requirement 10a, case 1)
  assert(
    derivePracticeItemStatus("x", [], { x: true }) === "corrected-here",
    "left remainingItemIds AND this window's own check graded it true -> corrected-here, stays visible"
  );
}

{
  // corrected elsewhere is dropped (requirement 10a, case 2)
  assert(
    derivePracticeItemStatus("x", [], {}) === "gone",
    "left remainingItemIds but this window never graded it true (corrected in another window/tab) -> gone"
  );
  assert(
    derivePracticeItemStatus("x", [], { x: false }) === "gone",
    "left remainingItemIds with only a stale false result (not true) from this window -> still gone, not corrected-here"
  );
}

{
  // still wrong stays (requirement 10a, case 3)
  assert(
    derivePracticeItemStatus("x", ["x"], {}) === "wrong",
    "still in live remainingItemIds -> wrong, regardless of local results"
  );
}

{
  // order preserved after server reorder (requirement 10a, case 4) —
  // shownPracticeItemIds filters the FROZEN snapshot (already in its own
  // order), never reorders by the live remainingItemIds array order.
  const snapshot = ["a", "b", "c"];
  const reorderedRemaining = ["c", "a"]; // server came back with "b" fixed, and a~c reordered
  const shown = shownPracticeItemIds(snapshot, reorderedRemaining, { b: false });
  assert(
    shown.join(",") === "a,c",
    `snapshot order ("a,c") must survive a server reorder of remainingItemIds, got "${shown.join(",")}"`
  );
}

{
  // empty remaining keeps corrected-here (requirement 10a, case 5)
  const shown = shownPracticeItemIds(["a", "b"], [], { a: true, b: true });
  assert(
    shown.join(",") === "a,b",
    "remainingItemIds empty (server says everything is done) but both ids were corrected BY THIS WINDOW -> both stay shown"
  );
}

// --- counting only still-wrong items (requirement 10b) — the existing
// stillWrongIds already does exactly this (strictly ===false, never
// undefined/true); confirmed here against a shown list that includes a
// corrected-here id, to lock in that corrected-here never gets counted. ---
{
  // snapshot a/b/c; only c still wrong per the server; a corrected-here
  // (true, stays shown); b never touched by this window (gone, dropped).
  const shown = shownPracticeItemIds(["a", "b", "c"], ["c"], { a: true, c: false });
  const wrongOnly = stillWrongIds(shown, { a: true, c: false });
  assert(
    shown.join(",") === "a,c" && wrongOnly.join(",") === "c",
    `shown should be "a,c" and only "c" (strictly false) should count as still-wrong, got shown="${shown.join(",")}" wrongOnly="${wrongOnly.join(",")}"`
  );
}

// --- wrapper stays mounted when remaining is empty but corrected-here is
// not (requirement 10c / RISK 1, error-review-block.tsx) ---
{
  assert(
    hasVisiblePracticeItems(["a"], [], { a: true }) === true,
    "remainingItemIds empty but the id was corrected-here -> wrapper must stay mounted as practice, not switch to the done banner yet"
  );
  assert(
    hasVisiblePracticeItems(["a"], [], {}) === false,
    "remainingItemIds empty and nothing corrected-here (corrected elsewhere, or never attempted) -> nothing left to show"
  );
}

// --- prunePracticeResults — the non-destructive prune used after every
// refresh: never erases a true (corrected-here) entry while its id is
// still in the snapshot, even though it already left remainingItemIds;
// still drops stale false/ghost entries that genuinely left scope. ---
{
  const next = prunePracticeResults({ a: true, b: false, c: false }, ["c"], ["a", "b", "c"]);
  assert(
    next.a === true && next.b === undefined && next.c === false,
    `prunePracticeResults must keep a (true, corrected-here) and c (still live), drop b (false, left scope) — got ${JSON.stringify(next)}`
  );
}

// --- sync test (requirement 10d) — "an item corrected through the
// scene-mode check path no longer appears in the remaining list that the
// cabinet data loader returns, and vice versa". Both loadSceneErrorReviewEntries
// (scene-error-review.ts, used by the scene page AND the inline
// ErrorReviewBlock) and the cabinet mistakes loader build their entries
// through the exact same buildErrorReviewEntry (this file) — there is no
// separate "cabinet" vs "scene" remainingItemIds computation; both read
// the SAME correctedItemIds/failedAttempts (get_mistake_correction_state
// RPC) and the same mistakes rows for a given (student, task). A live
// Supabase isn't available here (CLAUDE.md forbids querying the DB from
// this session), so this test MOCKS the one thing that differs between
// the two loaders — nothing about buildErrorReviewEntry itself: it calls
// buildErrorReviewEntry twice with the IDENTICAL params a "scene check"
// and a "cabinet check" would each have produced (same mistakeRows,
// correctedItemIds, failedAttempts — standing in for "the practice/check
// route wrote corrected_item_ids once, both loaders then read that same
// row") and asserts both calls agree on remainingItemIds. This proves the
// two loaders cannot disagree about which items are "remaining" as long
// as they're fed the same corrected_item_ids state — the real
// synchronization guarantee lives in the DB write being shared (already
// true before this task; not something either loader decides on its
// own).
{
  const mistakeRows = [
    {
      createdAt: "2026-01-01T00:00:00Z",
      detail: { items: [{ id: "q1", options: [{ correct: true, selected: false }] }] },
    },
  ];
  // Simulates: the scene-mode check route just wrote corrected_item_ids
  // after the student corrected q1 THERE.
  const sceneLoaderEntry = buildErrorReviewEntry({
    taskId: "t1",
    taskType: "multiple_choice",
    mistakeRows,
    correctedItemIds: ["q1"],
    failedAttempts: {},
  });
  // Simulates: the cabinet page loads the SAME task a moment later,
  // reading the SAME corrected_item_ids row (RPC) — not a separate,
  // cabinet-only correction state.
  const cabinetLoaderEntry = buildErrorReviewEntry({
    taskId: "t1",
    taskType: "multiple_choice",
    mistakeRows,
    correctedItemIds: ["q1"],
    failedAttempts: {},
  });
  assert(
    sceneLoaderEntry.remainingItemIds.length === 0 && cabinetLoaderEntry.remainingItemIds.length === 0,
    "q1 corrected via the scene-mode check path must no longer appear in remainingItemIds for the cabinet loader (and vice versa) — both loaders agree once fed the same corrected_item_ids"
  );
  assert(
    sceneLoaderEntry.status === "done" && cabinetLoaderEntry.status === "done",
    "both loaders must agree the task is fully fixed once the shared corrected_item_ids state says so"
  );
}

// --- shouldShowRevealPill (owner report: "Відповідь" pill in the
// cabinet true_false footer adds nothing with only two options) ---
{
  const noop = () => {};
  assert(
    shouldShowRevealPill(noop, undefined) === true,
    "onReveal present, hideRevealPill not set -> pill shows (unchanged default for every other type/flow)"
  );
  assert(
    shouldShowRevealPill(noop, false) === true,
    "onReveal present, hideRevealPill explicitly false -> pill shows"
  );
  assert(
    shouldShowRevealPill(noop, true) === false,
    "onReveal present but hideRevealPill true (true_false, cabinet) -> pill hidden"
  );
  assert(
    shouldShowRevealPill(undefined, undefined) === false,
    "no onReveal at all (e.g. letter_gaps/letter_rearrangement/table_fill scene-mode, answer panel handles reveal instead) -> pill hidden, same as before this prop existed"
  );
  assert(
    shouldShowRevealPill(undefined, true) === false,
    "neither onReveal nor hideRevealPill matters when onReveal itself is absent -> still hidden"
  );
}

// --- reorderWordState (owner report: reorder words colored green/red
// LIVE while dragging, before any check — too strong a hint) ---
{
  // before check -> neutral, regardless of positionCorrect/arrangementChanged
  assert(reorderWordState(false, true, false) === "neutral", "no check yet, happens to be in the right spot -> neutral, no hint before checking");
  assert(reorderWordState(false, false, false) === "neutral", "no check yet, wrong spot -> still neutral (nothing to hide, nothing to show)");
  assert(reorderWordState(false, true, true) === "neutral", "no check yet at all -> neutral regardless of arrangementChangedSinceCheck");
}

{
  // after check, mixed results -> correct/wrong per position
  assert(reorderWordState(true, true, false) === "correct", "checked this exact arrangement, position correct -> correct");
  assert(reorderWordState(true, false, false) === "wrong", "checked this exact arrangement, position wrong -> wrong");
}

{
  // after a move post-check -> back to neutral until the next check
  assert(
    reorderWordState(true, true, true) === "neutral",
    "a check happened, but the student moved a word since -> neutral even though that position used to be correct"
  );
  assert(
    reorderWordState(true, false, true) === "neutral",
    "a check happened, student moved a word since -> neutral even for a position that used to be wrong"
  );
}

{
  // after a second check -> colored again
  assert(
    reorderWordState(true, true, false) === "correct",
    "a fresh check on the current (post-move) arrangement -> colored again, correct"
  );
  assert(
    reorderWordState(true, false, false) === "wrong",
    "a fresh check on the current (post-move) arrangement -> colored again, wrong"
  );
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
}
console.log("All error-review tests passed.");
