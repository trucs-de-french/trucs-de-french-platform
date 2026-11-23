# Unanswered items never counted as mistakes — backfill decision doc

Context: `aggregateWrongItems` (`src/lib/exercises/error-review.ts`) previously
dropped any item that was never covered by *any* historical `mistakes` row for
a task — which is exactly what happens when a student submits block 1 of a
block-based exercise (letter_gaps, letter_rearrangement, multiple_choice,
true_false, word_choice, matching, table_fill) and never attempts block 2 (or
any later block). That item silently never became a "mistake," even though it
was never answered correctly either. The code fix changes this going
forward — this document is only about **existing, already-recorded** data.

**No SQL in this file was run. No UPDATE/INSERT/DELETE is included anywhere.**
Every statement below is a plain `select`, meant for the Supabase SQL Editor,
read-only.

## What a backfill would need to do, in plain words

1. For every `(user_id, task_id)` pair of one of the 7 affected types, look at
   **all** of that user's `mistakes` rows for that task, oldest to newest —
   exactly what `aggregateWrongItems` does today.
2. For each item the task's current `config` defines (a word index for
   letter_gaps/letter_rearrangement, or an id for the other 5 types), check
   whether *any* row's `ai_feedback` ever covered it.
3. An item that is in the config but was **never** covered by any row is now
   "wrong" under the new rule. If that item is also not already in
   `mistake_corrections.corrected_item_ids` for that user+task, it should be
   added to the error-review list — i.e. it would start showing up as a card
   to fix, exactly as if a new wrong `mistakes` row had just been written for
   it, except no new `mistakes` row actually needs to be inserted: the
   existing code recomputes `wrongItemIds` live from `aggregateWrongItems`
   every time the page loads, now including it automatically. **A backfill
   for this specific bug is therefore likely unnecessary — the fixed code
   already surfaces these items retroactively, from the mistakes rows that
   already exist, the next time the page is viewed.**
4. The one case a backfill *would* matter for: a task where the student's
   block 1 was fully correct (so no `mistakes` row was ever written at all —
   `recordTaskAttempt` only inserts a row when `!correct`) and block 2 was
   never attempted. That task has **zero** `mistakes` rows, so it's filtered
   out before `aggregateWrongItems` ever runs (`scene-error-review.ts`/the
   scene page only call `buildErrorReviewEntry` for tasks that already have
   at least one mistake row). Surfacing *this* case would require either (a)
   inserting a synthetic `mistakes` row with a detail showing the unanswered
   items as wrong, or (b) changing the list-building query to also include
   tasks with `progress.score < 100` and zero mistake rows. Both are judgment
   calls about product behavior, not something this audit should do
   automatically — hence: read-only queries below to find how many such
   cases exist, so you can decide.

## Query 1 — tasks with mistake rows that are affected right now (the common case)

Approximate, read-only. For the 5 types whose graded detail *omits* unanswered
items from the array entirely (multiple_choice/true_false/word_choice/
matching/table_fill), this compares the task's current configured item count
against the largest per-row detail array length ever recorded for that
user+task — a config count bigger than every row's detail count is a strong
signal that at least one item was never covered by any row.

```sql
-- READ-ONLY. Safe to run as-is in the Supabase SQL Editor.
with mistake_rows as (
  select
    m.user_id,
    m.task_id,
    t.type,
    m.ai_feedback,
    m.created_at
  from public.mistakes m
  join public.tasks t on t.id = m.task_id
  where t.type in ('multiple_choice', 'true_false', 'word_choice', 'matching', 'table_fill')
),
detail_len as (
  select
    user_id,
    task_id,
    type,
    case type
      when 'multiple_choice' then jsonb_array_length(coalesce(ai_feedback -> 'items', '[]'::jsonb))
      when 'true_false'      then jsonb_array_length(coalesce(ai_feedback -> 'statements', '[]'::jsonb))
      when 'word_choice'     then jsonb_array_length(coalesce(ai_feedback -> 'sentences', '[]'::jsonb))
      when 'matching'        then jsonb_array_length(coalesce(ai_feedback -> 'pairPoints', '[]'::jsonb))
      -- table_fill: one row can contribute up to 2 "blanks" entries sharing
      -- the same rowId — count distinct rowId, not blanks.length.
      when 'table_fill' then (
        select count(distinct b ->> 'rowId')
        from jsonb_array_elements(coalesce(ai_feedback -> 'blanks', '[]'::jsonb)) b
      )
    end as row_item_count
  from mistake_rows
),
max_seen as (
  select user_id, task_id, type, max(row_item_count) as max_row_item_count, count(*) as mistake_row_count
  from detail_len
  group by user_id, task_id, type
),
config_count as (
  select
    t.id as task_id,
    t.type,
    case t.type
      when 'multiple_choice' then jsonb_array_length(coalesce(t.config -> 'items', '[]'::jsonb))
      when 'true_false'      then jsonb_array_length(coalesce(t.config -> 'statements', '[]'::jsonb))
      when 'word_choice'     then jsonb_array_length(coalesce(t.config -> 'sentences', '[]'::jsonb))
      when 'matching'        then jsonb_array_length(coalesce(t.config -> 'pairs', '[]'::jsonb))
      when 'table_fill'      then jsonb_array_length(coalesce(t.config -> 'rows', '[]'::jsonb))
    end as config_item_count
  from public.tasks t
  where t.type in ('multiple_choice', 'true_false', 'word_choice', 'matching', 'table_fill')
)
select
  ms.user_id,
  ms.task_id,
  ms.type,
  ms.mistake_row_count,
  ms.max_row_item_count,
  cc.config_item_count,
  (cc.config_item_count - ms.max_row_item_count) as likely_never_covered_count,
  p.score as latest_score,
  p.best_score
from max_seen ms
join config_count cc on cc.task_id = ms.task_id
left join public.progress p on p.user_id = ms.user_id and p.task_id = ms.task_id
where cc.config_item_count > ms.max_row_item_count
order by likely_never_covered_count desc;
```

## Query 2 — letter_gaps / letter_rearrangement (positional, exact)

These two types always keep a full-length `words` array in every row's
`ai_feedback` — the "never answered" signal is per-word (`studentLetters`
empty for letter_gaps, `inScope: false` for letter_rearrangement — or absent,
which means *always* in scope for rows predating that field), not a shorter
array. This query is exact, not a heuristic: it checks, for every word index
in the task's current config, whether *any* historical row ever had that word
actually in scope.

```sql
-- READ-ONLY. Safe to run as-is.
with mistake_rows as (
  select m.user_id, m.task_id, t.type, m.ai_feedback
  from public.mistakes m
  join public.tasks t on t.id = m.task_id
  where t.type in ('letter_gaps', 'letter_rearrangement')
),
word_scope as (
  select
    mr.user_id,
    mr.task_id,
    mr.type,
    (w.ord - 1) as word_index,
    case
      when mr.type = 'letter_gaps' then
        jsonb_array_length(coalesce(w.elem -> 'correctLetters', '[]'::jsonb)) > 0
        and jsonb_array_length(coalesce(w.elem -> 'studentLetters', '[]'::jsonb))
          = jsonb_array_length(coalesce(w.elem -> 'correctLetters', '[]'::jsonb))
      else
        -- letter_rearrangement: inScope absent (older rows) counts as in scope.
        coalesce((w.elem -> 'inScope')::text::boolean, true)
    end as in_scope
  from mistake_rows mr
  cross join lateral jsonb_array_elements(coalesce(mr.ai_feedback -> 'words', '[]'::jsonb)) with ordinality as w(elem, ord)
),
ever_in_scope as (
  select user_id, task_id, type, word_index, bool_or(in_scope) as was_ever_in_scope
  from word_scope
  group by user_id, task_id, type, word_index
),
config_words as (
  select t.id as task_id, t.type, (gen.ord - 1) as word_index
  from public.tasks t
  cross join lateral jsonb_array_elements(coalesce(t.config -> 'words', '[]'::jsonb)) with ordinality as gen(elem, ord)
  where t.type in ('letter_gaps', 'letter_rearrangement')
)
select
  cw.task_id,
  cw.type,
  e.user_id,
  count(*) filter (where e.was_ever_in_scope is not true) as never_covered_word_count,
  p.score as latest_score,
  p.best_score
from config_words cw
join ever_in_scope e on e.task_id = cw.task_id and e.word_index = cw.word_index
left join public.progress p on p.user_id = e.user_id and p.task_id = e.task_id
group by cw.task_id, cw.type, e.user_id, p.score, p.best_score
having count(*) filter (where e.was_ever_in_scope is not true) > 0
order by never_covered_word_count desc;
```

## Query 3 — the zero-mistake-row case (block 1 perfect, block 2 untouched)

Finds tasks of the 7 affected types where the student has a `progress.score`
below 100 but **no** `mistakes` row exists at all — the case Query 1/2 cannot
see, because `aggregateWrongItems` is never even called for these today.

```sql
-- READ-ONLY. Safe to run as-is.
select p.user_id, p.task_id, t.type, p.score, p.best_score, p.attempts
from public.progress p
join public.tasks t on t.id = p.task_id
where t.type in (
  'letter_gaps', 'letter_rearrangement', 'multiple_choice',
  'true_false', 'word_choice', 'matching', 'table_fill'
)
and p.score is not null
and p.score < 100
and not exists (
  select 1 from public.mistakes m where m.user_id = p.user_id and m.task_id = p.task_id
)
order by p.score asc;
```

## Recommendation

Run Query 1, 2, and 3, look at the row counts. For the vast majority of real
cases (anything Query 1 or 2 finds), **no backfill is needed** — the code fix
already makes `aggregateWrongItems` recompute correctly from the mistakes
rows that already exist, every time the page is loaded; there is nothing
stale to migrate. Query 3's result set is the only one that needs a decision:
whether "block 1 was perfect, block 2 was never attempted" should actively
surface as a mistake to fix, which is a product-behavior question, not a data
migration — no SQL write is proposed here either way.
