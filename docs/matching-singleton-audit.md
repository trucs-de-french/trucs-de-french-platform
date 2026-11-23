# Matching "no singleton" group rule — block-progress impact audit

Context: `chunkMatchingPairs` (`src/lib/exercises/exercise-blocks.ts`) changes
how matching pairs are grouped into blocks of 5, merging a trailing lone pair
into the previous group instead of leaving it alone (11 pairs: `5,5,1` ->
`5,6`). This only changes tasks where `pairs.length % 5 === 1` (6, 11, 16,
21, ...). This document is the read-only audit requested for that change's
effect on already-stored `public.progress.block_progress` — **no SQL in this
file was run, and none of it is a write.**

## Finding: no misread risk for the visual "block checked" state

`matching.tsx`'s per-block "checked" state (`blockResults`, a plain
`useState<Record<number, MatchingResult>>({})`, and `practiceBlockAttempted`,
the same pattern) is **pure client-side session memory** — it starts empty on
every mount and is only ever populated by `submitBlock`/`submitPractice`
calls made *during that same page view*. It is never seeded or rehydrated
from the persisted `block_progress` column. Reloading the page already resets
which blocks show as checked, regardless of this change — so there is no
"stale block index now points at the wrong block visually" bug to introduce:
that failure mode would require the component to read `block_progress` back
into its chip/checkmark state, and it doesn't.

## Finding: the stored score sum is also not affected by re-chunking

`record_block_task_attempt` (`supabase/migrations/0052_block_progress.sql`)
merges one block's `{pointsEarned, pointsPossible, attempts}` into the
`block_progress` jsonb map under key `String(blockIndex)`, then computes
`progress.score` as `round(100 * sum(pointsEarned over all keys) /
totalPointsPossible)`. This sum does not care how many keys exist or what
they're called — summing the three old parts of an 11-pair task (a 5-pair
block, a 5-pair block, and a 1-pair block) gives exactly the same total
`pointsEarned` as summing two new parts would (5-pair + 6-pair), because the
underlying per-pair point values never change — only how they're *grouped*
for a fresh submission going forward. Every other consumer of
`block_progress` (`home-data.ts`, `progress-data.ts`, `achievements.ts`,
`library-data.ts`, the scene page, `scene-summary.ts`) only ever sums its
values for aggregate display (streaks, progress bars) — none of them index
into it by a freshly recomputed block boundary.

## The one real risk: a double-counted stale key after this ships

The RPC's merge is a `jsonb_set` **overwrite by key**, not a recompute from
scratch. For an 11-pair task, under the *old* rule there were 3 possible keys
(`"0"`, `"1"`, `"2"` — sizes 5, 5, 1). Under the *new* rule there are only 2
(`"0"`, `"1"` — sizes 5, 6). A student who, **before this code change
shipped**, had already submitted the old block `"2"` (the lone pair) has that
key sitting in their `block_progress` forever. If they come back **after**
this change and submit the new block `"1"` (now 6 pairs, which includes that
same pair), the RPC records a *new* `pointsEarned` for key `"1"` that already
includes that pair's point — while the *old* key `"2"` entry for the same
pair is never removed (nothing in the app ever deletes a `block_progress`
key). The sum now double-counts that one pair's points, inflating
`score`/`best_score` slightly. This is a **real but narrow and low-severity**
exposure:

- It only affects tasks where `pairs.length % 5 === 1`.
- It only affects a student who had *already submitted the old trailing
  single-pair block* before this deploy, *and* goes on to resubmit the
  now-merged block afterward.
- It can only inflate a score (never crash, never lose data, never block the
  task from being markable "resolved") — the worst outcome is a slightly
  too-generous `best_score`/`score` for a handful of students on a handful
  of tasks, bounded by a few points' worth of one pair.
- There is no way to prevent it from pure application code without either
  migrating/deleting the stale key (a DB write, not done here) or changing
  the RPC's merge key scheme entirely (a schema/migration change, also not
  done here and far outside this task's scope). The mitigation available at
  this layer — making sure the component never *reads* stale block-indexed
  state for display — was already true before this change (see above), so
  there was nothing left to "fix in code" beyond that.

## Read-only queries to find how exposed you are

**I did not run these** — per project policy, DB access goes through the
owner's Supabase SQL Editor. Paste them there; nothing here writes anything.

### Query 1 — how many matching tasks even have `pairs % 5 == 1`

```sql
-- READ-ONLY.
select
  t.id as task_id,
  t.scene_id,
  t.task_group_id,
  jsonb_array_length(coalesce(t.config -> 'pairs', '[]'::jsonb)) as pair_count,
  jsonb_array_length(coalesce(t.config -> 'pairs', '[]'::jsonb)) % 5 as remainder
from public.tasks t
where t.type = 'matching'
  and jsonb_array_length(coalesce(t.config -> 'pairs', '[]'::jsonb)) % 5 = 1
order by pair_count desc;
```

### Query 2 — which (user, task) pairs are actually exposed to the double-count risk

Exposed = a `matching` task with `pairs % 5 == 1` where some student already
has a `block_progress` entry under the key that is the *old* last block index
(`ceil(pairs / 5) - 1`, 0-based) — the block that will no longer exist on its
own after this change, and whose pair would get folded into the new last
block.

```sql
-- READ-ONLY.
with singleton_tasks as (
  select
    t.id as task_id,
    jsonb_array_length(coalesce(t.config -> 'pairs', '[]'::jsonb)) as pair_count,
    (ceil(jsonb_array_length(coalesce(t.config -> 'pairs', '[]'::jsonb))::numeric / 5) - 1)::text as old_last_block_key
  from public.tasks t
  where t.type = 'matching'
    and jsonb_array_length(coalesce(t.config -> 'pairs', '[]'::jsonb)) % 5 = 1
)
select
  p.user_id,
  st.task_id,
  st.pair_count,
  st.old_last_block_key,
  p.block_progress -> st.old_last_block_key as old_block_entry,
  p.score,
  p.best_score
from singleton_tasks st
join public.progress p on p.task_id = st.task_id
where p.block_progress ? st.old_last_block_key
order by st.pair_count desc;
```

A non-empty result from Query 2 is the exact, precise list of students whose
score *could* become slightly inflated the next time they resubmit the new
merged block for that task. Given the narrow, low-severity nature described
above, no further action is proposed here — this is purely so you can decide
whether to also do something about it (e.g. a manual one-off cleanup of those
specific stale keys, decided separately, outside this task).
