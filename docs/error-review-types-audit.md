# "Робота над помилками" (error review) — task-type audit

Read-only code audit. No behavior was changed by this document.

## Sources of truth (code)

- `supabase/migrations/0051_karaoke_task_type.sql` — current, cumulative `tasks_type_check` constraint (29 types; the file's own comment says it was verified against `pg_get_constraintdef` on production).
- `src/lib/exercises/gradable-types.ts` — `GRADABLE_TASK_TYPES` (19 types that go through `/api/exercises/check` and can ever produce a `mistakes` row).
- `src/lib/exercises/error-review.ts`:
  - `ERROR_REVIEW_EXCLUDED_TASK_TYPES` (line 13) — explicit exclusion list.
  - `PRACTICE_ITEMS_TASK_TYPES` (line 26) — "items" mode, real implementation (11 types).
  - `ITEMS_MODE_TASK_TYPES` (line 46) — documents a *planned* items-mode type (`open_answer`) with no real implementation yet.
  - `WHOLE_MODE_TASK_TYPES` (line 58) — "whole" mode, real implementation (4 types).
  - `reviewMode()` (line 91) and `isMistakePracticeSupported()` (line 79) — the actual gate used everywhere else.
- `src/components/exercises/error-review-block.tsx` — `ErrorReviewPractice`'s `renderExercise()` switch (lines 224–390): one `case` per supported type, `default: return null` (line 388).
- `src/lib/cabinet/scene-error-review.ts` and `src/app/courses/[productId]/scenes/[sceneId]/page.tsx` (~544–694) — the two parallel list-builders, both filtering with `isMistakePracticeSupported`.
- `src/lib/cabinet/mistakes-overview.ts` (lines 8–16) — standalone `/cabinet/mistakes` page, same filter, and its own comment documenting that DELF tasks (no scene) are excluded by construction.
- `src/lib/progress.ts` (`recordTaskAttempt`, `hasReportableErrors`) — what actually writes to `mistakes`.
- `src/app/api/exercises/practice/check/route.ts`, `.../practice/reveal/route.ts` — the practice API, gated by `isPracticeItemsTaskType(type) || isWholePracticeTaskType(type)`.

## All 29 types in `tasks_type_check`

`game, open_answer, listening, error_correction, vocab_quiz, embed, link, essay_check, ai_examiner, fill_blank, multiple_choice, true_false, matching, reorder, drag_drop, sort_columns, flip_cards, callout, phonetics, table_fill, image_match, checkbox_grid, chronological_order, letter_gaps, letter_rearrangement, word_choice, word_search, crossword, karaoke`

19 of these are in `GRADABLE_TASK_TYPES` (gradable-types.ts:6-26); the other 10 (`game, error_correction, embed, link, essay_check, ai_examiner, flip_cards, callout, phonetics, vocab_quiz`) never reach `/api/exercises/check` and so never produce a `mistakes` row at all.

## Full table

| type | in error review | mode | item id | practice blocks | what records mistakes | exclusion reason (file:line) |
|---|---|---|---|---|---|---|
| multiple_choice | yes | items | `item.id` (real id) | none (flat only) | `recordTaskAttempt`: `!correct` → `mistakes` insert (progress.ts:71-80), universal for all gradable types via `/api/exercises/check/route.ts:81` | — |
| fill_blank | yes | items | positional `String(blankIndex)` | none (flat only) | same | — |
| true_false | yes | items | `statement.id` | none (flat only) | same | — |
| word_choice | yes | items | `sentence.id` | **none in practice** (flat only), even though the real exercise supports `chunk(EXERCISE_BLOCK_SIZE)` blocks (word-choice.tsx uses `EXERCISE_BLOCK_SIZE`/`chunk`, grep found no `isSceneMode`/`practiceBlocks` in the file) | same | — |
| letter_gaps | yes | items | positional `String(wordIndex)` | yes, `chunk(EXERCISE_BLOCK_SIZE)` (size 10) in both real exercise and practice (`isSceneMode`, letter-gaps.tsx:336-341) | same | — |
| letter_rearrangement | yes | items | positional `String(wordIndex)` | yes, same chunk size, both flows now share one render path (letter-rearrangement.tsx) | same | — |
| matching | yes | items | `pair.id` (synthetic, `getMatchingPairs`) | yes, `chunk(EXERCISE_BLOCK_SIZE)` | same | — |
| table_fill | yes | items | `row.id` | yes, `chunk(EXERCISE_BLOCK_SIZE)` | same | — |
| drag_drop | yes | items | `sentence.id` | none — "drag_drop не підтримує блоки взагалі" (error-review.ts:177-179) | same | — |
| image_match | yes | items | `item.id` | none — same no-blocks note (error-review.ts:184-187) | same | — |
| listening | yes | items | `question.id` | none — same no-blocks note (error-review.ts:192-195) | same | — |
| reorder | yes | whole | `WHOLE_TASK_ITEM_ID` ("__task__") | n/a (one task = one item) | same | — |
| chronological_order | yes | whole | `WHOLE_TASK_ITEM_ID` | n/a | same | — |
| sort_columns | yes | whole | `WHOLE_TASK_ITEM_ID` | n/a | same | — |
| checkbox_grid | yes | whole | `WHOLE_TASK_ITEM_ID` | n/a | same | — |
| **open_answer** | **no** (despite being gradable) | would be "whole" by `reviewMode()`'s fallback, but `isWholePracticeTaskType("open_answer")` is `false` (not in `WHOLE_MODE_TASK_TYPES`) | — | — | `recordTaskAttempt` still writes a `mistakes` row for it like any gradable type (progress.ts:71) — the row is just never surfaced, because `isMistakePracticeSupported` is false | `error-review.ts:46` — `ITEMS_MODE_TASK_TYPES = ["open_answer"]`, explicitly commented "документує майбутній план… `reviewMode()` для них повертає 'whole'" (planned, not implemented); no `case "open_answer"` in `error-review-block.tsx`'s switch (falls to `default: return null`, line 388); `open-answer-check.tsx` has no `practice` prop at all |
| essay_check | no | none | — | — | has its own `errors[]`-based path (`hasReportableErrors`, progress.ts:12-16) but is excluded from review UI regardless | `error-review.ts:13` list; comment line 8: "окрема DELF-перевірка Gemini" |
| word_search | no | none | — | — | writes to `mistakes` like any gradable type, just never shown | `error-review.ts:13` list; comment line 9: "ціла сітка… не список окремих елементів" |
| crossword | no | none | — | — | same | `error-review.ts:13` list; same comment |
| karaoke | no | none | — | — | same | `error-review.ts:13` list; same comment |
| vocab_quiz | no | none | — | — | not gradable at all (not in `GRADABLE_TASK_TYPES`) — never reaches `/api/exercises/check`, no `mistakes` row ever | `error-review.ts:13` list; comment line 10: "не пише в mistakes" (the explicit-exclusion entry is actually redundant with it not being gradable, but both are true) |
| game, error_correction, embed, link, ai_examiner, flip_cards, callout, phonetics | no | `reviewMode()` falls through to "whole" (default, error-review.ts:96) but `isWholePracticeTaskType` is false for all of them | — | — | not gradable (absent from `GRADABLE_TASK_TYPES`, gradable-types.ts:6-26) — never reach `/api/exercises/check`, no `mistakes` row ever | not explicitly listed, excluded only because `isMistakePracticeSupported` requires membership in one of the two real lists |
| DELF-attached tasks (any gradable type used inside a DELF test, `delf_section`/`delf_test_number` set instead of `scene_id`) | no, regardless of type | n/a | n/a | n/a | same as the type would otherwise get | `mistakes-overview.ts:8-16` — explicit comment: "Завдання без жодного ефективного scene_id (DELF-завдання продукту без групи й без прямої сцени) лишаються виключені… єдиний існуючий UI виправлення… прив'язана до сцени"; `scene-error-review.ts` and the scene page's own list-builder both query by `scene_id`/`task_group_id`, never by `delf_section` |

## Mismatches vs. the handoff statement

1. **`open_answer_check` is not actually wired.** The doc lists it under "Wave 2 (after DELF auto-check)" in a way that reads as already landed alongside Wave 1/3. In code, `open_answer` (not `open_answer_check` — that's only the component filename, `open-answer-check.tsx`; the DB/TS type string is `open_answer`) has zero real implementation: no `WHOLE_MODE_TASK_TYPES`/`PRACTICE_ITEMS_TASK_TYPES` membership, no switch case, no `practice` prop on the component. If "Wave 2" is meant as "not done yet, blocked on DELF auto-check" then the doc and code agree; if it's meant as "shipped," they don't. Worth asking the doc's author which reading was intended.
2. **Naming**: the doc's `open_answer_check` vs. the actual task-type string `open_answer` — cosmetic, but could confuse a future search of the codebase for that exact type string.
3. Everything else matches exactly: the doc's "Items mode wired" 7 + "Wave 1" 4 = the 11 entries of `PRACTICE_ITEMS_TASK_TYPES`, in the same order; "Wave 3" 4 = `WHOLE_MODE_TASK_TYPES` exactly; "Excluded" 5 = `ERROR_REVIEW_EXCLUDED_TASK_TYPES` exactly; "non-gradable" covers the remaining 8 non-gradable, non-explicitly-excluded types (`game, error_correction, embed, link, ai_examiner, flip_cards, callout, phonetics`). No type is supported in code but missing from the doc, and no doc-claimed type (other than `open_answer_check`) is actually missing from code.
4. **Not in the handoff statement at all, but relevant**: DELF-attached tasks of an otherwise-"included" type are silently excluded everywhere, purely because the feature is scene-scoped (`mistakes-overview.ts:8-16`). This isn't a per-type exclusion — any of the 15 "included" types loses error-review support the moment it's attached to a DELF test instead of a scene. The handoff statement doesn't mention this dimension at all.
5. **Not a mismatch, but a quiet inconsistency worth flagging**: `word_choice` is the only one of the 15 "included" types whose real exercise supports block-splitting (`chunk(EXERCISE_BLOCK_SIZE)`) but whose *practice* mode does not (flat/single-check only, confirmed by grep: no `isSceneMode`/`practiceBlocks`/`chunk` anywhere in its practice code path). `drag_drop`/`image_match`/`listening` are consistently blockless in both the real exercise and practice, so they're not an inconsistency — `word_choice` is the one case where the two don't match each other.

## Letter_gaps two-block scope question (report only, no fix)

**Scenario**: block 1 checked, block 2 never attempted (`letters` array sent by `letter-gaps.tsx`'s `submitBlock` has `null` at every position belonging to block 2).

**Answer: NOT skipped**, by either `aggregateWrongItems` or the list query — this is handled correctly today, by design:

- `grade.ts:262` — `const studentLetters = studentLettersByWord[wi] ?? [];` — a `null` entry becomes `[]`.
- `error-review.ts:123-125` — `letterGapsInScope(w)` returns `w.correctLetters.length > 0 && w.studentLetters.length === w.correctLetters.length`. For a block-2 word, `correctLetters.length > 0` (it's a real word) but `studentLetters.length === 0`, so this is `false` — the word is correctly treated as "not in scope for this particular check," not as "wrong."
- `error-review.ts:224-225` (`mistakeItemIds`) and `error-review.ts:320-321` (`itemsInDetail`) both gate on `letterGapsInScope(w)` before considering a word at all — block-2 words never enter either set for a block-1-only submission row.
- `aggregateWrongItems` (error-review.ts:448-474) only adds an id to `wrong` if it's present in `ids` (= `itemsInDetail` = in-scope words) for that row — so block-2 words are never falsely marked wrong by a block-1 submission.
- `positionalTotalInDetail` (error-review.ts:429-434) always returns the **full** `d.words.length` (every row's `detail.words` array is always full-length — only `studentLetters` differs per word, per the comment at error-review.ts:95-98), so it always equals `currentPositionalCount`'s full word count — the whole-row skip in `aggregateWrongItems` (`if (rowTotal !== positionalCount) continue`) is never triggered by this scenario; it only fires when the admin actually changes the word count.
- At the list-query level: `record_block_task_attempt` (progress.ts:44-57) computes the task's `progress.score` from `blockPointsPossible`/`totalPointsPossible` — with block 2 unattempted, the stored score is below 100, so `latestScoreByTask.get(id) !== 100` stays true and the task is **not** filtered out of the mistakes list either.

So today's code already excludes the untouched block's words from being wrongly counted, and keeps the task visible in the list. (If a different, actual bug was intended by "a separate prompt fixes this" — the audit didn't find one in this specific null/scope path; it may be elsewhere, e.g. in how `remainingItemIds`/chip counts interact across blocks, which this audit didn't trace further since it wasn't asked to.)
