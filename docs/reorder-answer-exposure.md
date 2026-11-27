# Reorder answer exposure — investigation and fix

Task: "correct order reaching the client before a check" (reorder), plus a
read-only audit of other exercise types. Investigated 2026, after commit
72afc4d removed the client-side consumption of `reorder`'s live-feedback
coloring.

## Part 2.1 — where reorder's words came from, traced end to end

- DB: `tasks.config` (JSON) holds `ReorderConfig.sequences[].items`, where
  `items` **is** the correct order (confirmed in `types.ts`'s own comment:
  `items: string[]; // items — правильний порядок`).
- Server component (`scenes/[sceneId]/page.tsx` for the scene's own
  exercise; `scene-error-review.ts`/the cabinet loader for practice) reads
  the raw `task.config` and calls `sanitizeConfigForStudent` →
  `sanitizeReorder(config)` (`src/lib/exercises/sanitize.ts`) before the
  value ever reaches a client component's props.
- `sanitizeReorder` returned, for every sequence:
  - `items: shuffle(s.items)` — a display-shuffled copy. This alone does
    not leak the answer (the client cannot tell "shuffled" from "already
    correct" without already knowing the solution).
  - **`correctOrder: s.items` — the raw, unshuffled correct order** —
    whenever `config.liveFeedback !== false`. Because `liveFeedback` was
    `undefined` on every task saved before this option existed, and
    because the admin default was "on", this field was present for
    essentially all existing reorder tasks, not just ones a teacher
    explicitly opted into.
  - This `correctOrder` field reached the client identically in all three
    places asked about: the scene's own exercise (`renderSequence` in
    `reorder.tsx`), the inline practice block (`ErrorReviewBlock` without
    `openMode`, same `ReorderExercise` component, `practice={{whole:true,...}}`),
    and the cabinet page (`openMode="scene"`, same component — reorder's
    whole-mode practice never branches between the two, confirmed in the
    prior task). It was visible in the RSC payload / React props / the
    Network tab's response body for the page, independent of whether the
    component used it for coloring.
  - `/api/exercises/practice/reveal` for `type: "reorder"` builds its
    answer from `task.config` (the server-side, unsanitized row), gated
    behind an authenticated POST — this is the same "explicit reveal"
    contract every other type uses, and reorder's current UI has no
    button that calls it, so it is reachable only by someone calling the
    API directly while logged in as themselves (same as any other type's
    reveal route — not a new or reorder-specific exposure).
  - `/api/exercises/practice/check` for `type: "reorder"` (whole-mode,
    same branch as chronological_order/sort_columns/checkbox_grid) returns
    the **full** `ReorderDetail` in the response's `detail` field after
    every check attempt — including `items[].text`/`correctIndex` for
    positions the student got wrong. This is the already-known "practice
    check response `detail` leak" backlog item (explicitly out of scope
    for this task) — listed in the table below for completeness, not
    fixed here.

**Conclusion: yes, the correct order reached the client before any check**,
through the explicit `correctOrder` field — not through the shuffled
`items` array, and not through a DB/schema gap.

## Part 2.2 — fix implemented (no DB/schema change needed)

The leak was a single sanitizer field, not a data-model problem: `items`
was already being shuffled server-side on every request, independently of
`correctOrder`. The fix removes `correctOrder` (and the `liveFeedback` flag
that gated it) from `sanitizeReorder`'s output entirely — `ReorderPublic`
no longer has either field, in any case, regardless of the saved config.
Grading is unaffected: `gradeReorder` (grade.ts) already reads from
`task.config` (the real, unsanitized server row), never from the public
payload — removing a field nothing server-side ever read changes nothing
about how a check is graded. Reveal is unaffected for the same reason.

This doubles as Part 1's removal of the `liveFeedback` admin option (see
below) — the same field was the single gate for both problems.

## Part 2.3 — stop condition

Not triggered. The fix was a pure subtraction in one sanitizer function,
already safe by construction (nothing else read the removed fields — see
the grep-backed check below) with no DB/schema change and no change to the
grading contract.

## Part 2.4 — read-only audit of other types

| type | field | where it leaks | severity |
|---|---|---|---|
| reorder | ~~`sequences[].correctOrder`~~ | sanitizeReorder → public config | **fixed in this task** |
| letter_gaps | `words[].hiddenLetters` | sanitizeLetterGaps → public config, always present | known, accepted design tradeoff (documented in `types.ts`: same compromise as crossword's `solution`) — the hidden letters are needed client-side for live per-letter correctness coloring while typing |
| crossword | `solution` (grid letters) | sanitizeCrossword → public config, always present, no flag | known, accepted design tradeoff (same category as letter_gaps) |
| reorder, chronological_order, sort_columns, checkbox_grid | full `*Detail` (e.g. `ReorderDetail.items[].text/correctIndex`, `ChronologicalOrderDetail.items[].correctPosition`, `SortColumnsDetail.items[].correctColumnId`, checkbox_grid's `correctChecked`) | `/api/exercises/practice/check` response `detail` field, returned after every practice check attempt, including positions the student got wrong | **known separate backlog item** (explicitly out of scope here) — whole-mode types have no masking layer equivalent to `practiceOptionDetail` (used by multiple_choice/true_false/word_choice/listening in items-mode to withhold the correct answer pre-reveal), so a wrong practice attempt already shows the full correct arrangement in the response body |
| multiple_choice, true_false, word_choice, listening (items-mode) | — | practice/check response `detail` is a synthetic, masked object (`practiceOptionDetail`) that deliberately sets `correct:false` on every option when the item is wrong, specifically to avoid this leak | not affected — already safe by design |
| matching, table_fill, letter_rearrangement, drag_drop, image_match (items-mode) | — | right/bank/shuffled-letters kept secret server-side (`right` not tied to `left` id publicly; bank/letters shuffled, correct mapping withheld until reveal) | not affected, already safe by design |

Only the row marked "fixed in this task" was changed. The `detail` leak row
is reported, not fixed, per the task's explicit instruction.

## Part 1 — dead admin option `liveFeedback`

Removed entirely (6 places, all in this repo — no separate docs mentioned
it, and the admin toggle used plain hardcoded Ukrainian strings, not i18n
keys, so there were no i18n keys to remove):

1. `src/app/admin/courses/[id]/tasks/reorder-fields.tsx` — the checkbox
   control (`reorder_live_feedback`), its two explanatory `<p>` hints, and
   the `liveFeedback` state/`getValue()` field.
2. `src/lib/exercises/task-config-builder.ts` — stopped writing
   `liveFeedback` into the saved config on task save.
3. `src/lib/exercises/types.ts` — removed `ReorderConfig.liveFeedback`,
   `ReorderPublic.liveFeedback`, and `ReorderPublic.sequences[].correctOrder`.
4. `src/lib/exercises/sanitize.ts` — `sanitizeReorder` no longer reads
   `config.liveFeedback` or emits `correctOrder` (see Part 2.2).
5. `src/components/exercises/reorder.tsx` — already fully disconnected by
   commit 72afc4d (no code change needed here beyond that prior commit;
   only historical comments remain, referring to the removed mechanism in
   the past tense).
6. `src/lib/exercises/sanitize.test.ts` — added tests (Part 1.3 / Part 2's
   unit coverage): a legacy config with `liveFeedback: true` still
   sanitizes without error and never emits `correctOrder`; a modern config
   with no `liveFeedback` field at all behaves the same.

No DB migration was written and no DB write was run, as instructed.
Existing rows may still have a `liveFeedback` key sitting unused in their
saved `config` JSON — nothing in the code reads it anymore (there is no
separate validation schema in this project — no zod or similar — that
could reject the stray key), so it is silently and permanently ignored,
never causing a crash or a validation failure. Cleaning those rows, if
wanted, is a separate decision.
