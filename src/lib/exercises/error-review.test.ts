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

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
}
console.log("All error-review tests passed.");
