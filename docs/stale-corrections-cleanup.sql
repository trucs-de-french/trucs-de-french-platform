-- ============================================================================
-- One-off cleanup for mistake_corrections rows that are already stale
-- ("Застарілі виправлення ховають нову помилку", audit Case A — see the
-- audit report and the fix in supabase/migrations/0071_clear_mistake_
-- corrections.sql). 0071 only prevents NEW staleness going forward
-- (recordTaskAttempt clears the specific ids that fail again); it does
-- NOT retroactively fix rows that are already stale, like
-- 56bbeccd-75a2-4954-a6e8-4e01496f446a from the audit.
--
-- NOT a migration — do not put this under supabase/migrations/, do not run
-- it automatically. Run part (a) first, review the output with the owner,
-- and only then consider running part (b) — manually, in the Supabase SQL
-- editor, after explicit confirmation.
--
-- Known limitation of this heuristic (same reasoning as the audit's
-- rejection of a pure timestamp-based fix): mistake_corrections.updated_at
-- is ONE timestamp per (user_id, task_id) ROW, not per item. Any later
-- correction of a DIFFERENT item in the same task also bumps updated_at
-- (save_mistake_correction always sets updated_at = now() on every write).
-- So "a mistakes row exists with created_at > mc.updated_at" is a
-- TASK-LEVEL signal, not an item-level one: part (b) below clears
-- corrected_item_ids ENTIRELY for a matching row, which may also
-- un-resolve items that were separately and legitimately corrected and
-- have nothing to do with the newer mistake. This is the coarse,
-- conservative direction (never hides something that should show), but it
-- can make already-fixed items temporarily reappear as unresolved. The
-- precise fix (recompute wrongItemIds via the app's own
-- aggregateWrongItems/mistakeItemIds against full mistakes history, per
-- item, per task) requires the app's TypeScript logic, not plain SQL — a
-- separate one-off script, not this file. Use part (a) to see how many
-- rows are actually affected before deciding whether the coarse SQL fix
-- below is acceptable or whether the precise script is worth writing.
-- ============================================================================

-- (a) READ-ONLY: list every mistake_corrections row where at least one
-- mistakes row for the same (user_id, task_id) was created AFTER the
-- correction's updated_at — i.e. a candidate for "a newer mistake exists
-- that this stored correction predates and may be wrongly hiding".
select
  mc.user_id,
  mc.task_id,
  mc.corrected_item_ids,
  mc.failed_attempts,
  mc.updated_at as correction_updated_at,
  count(m.id) as newer_mistakes_count,
  max(m.created_at) as latest_mistake_at
from public.mistake_corrections mc
join public.mistakes m
  on m.user_id = mc.user_id
 and m.task_id = mc.task_id
 and m.created_at > mc.updated_at
group by mc.user_id, mc.task_id, mc.corrected_item_ids, mc.failed_attempts, mc.updated_at
order by latest_mistake_at desc;

-- (b) COMMENTED OUT — review (a) first, confirm with the owner, then run
-- manually. Clears corrected_item_ids and failed_attempts ENTIRELY for
-- every row (a), not just the specific ids that regressed (see the
-- limitation above). Does not touch config_hash.
--
-- update public.mistake_corrections mc
-- set corrected_item_ids = '{}'::text[],
--     failed_attempts = '{}'::jsonb,
--     updated_at = now()
-- where exists (
--   select 1
--   from public.mistakes m
--   where m.user_id = mc.user_id
--     and m.task_id = mc.task_id
--     and m.created_at > mc.updated_at
-- );
