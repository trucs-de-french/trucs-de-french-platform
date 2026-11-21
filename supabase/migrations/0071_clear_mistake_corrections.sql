-- ============================================================================
-- clear_mistake_corrections — фікс "застарілі виправлення ховають нову
-- помилку" (аудит, Case A): recordTaskAttempt (progress.ts) викликає цю
-- функцію одразу після вставки нового рядка mistakes, щоб прибрати ids
-- елементів, що ЩОЙНО знову стали неправильними, із mistake_corrections.
-- corrected_item_ids/failed_attempts.
--
-- Без цього: get_mistake_correction_state.corrected_item_ids (0054/0055)
-- лише РОСТЕ (save_mistake_correction пише повний новий стан, але викликач,
-- practice/check/route.ts, лише ДОДАЄ елементи, ніколи не забирає) — елемент,
-- що колись виправили в режимі практики, а потім знову провалили у ЗВИЧАЙНІЙ
-- (не практичній) перевірці, назавжди лишався б "виправленим" у
-- buildErrorReviewEntry (error-review.ts: remainingItemIds = wrongItemIds.
-- filter(id => !correctedSet.has(id))) — і зникав зі списку "Робота над
-- помилками", хоча студент щойно реально провалив його знову.
--
-- Той самий auth-режим, що save_mistake_correction (0054/0055):
-- security invoker — спрацьовує лише завдяки наявній RLS-політиці
-- mistake_corrections_update_own (0054: user_id = auth.uid()), нова функція
-- жодних власних прав не обходить. config_hash НЕ торкається — лише
-- save_mistake_correction вирішує, коли переставити хеш (зміна завдання).
--
-- Якщо рядка (user_id, task_id) ще нема — нічого не робить (UPDATE просто не
-- знаходить рядків, без помилки).
--
-- Відкат: drop function public.clear_mistake_corrections(uuid, uuid, text[]);
-- ============================================================================

create or replace function public.clear_mistake_corrections(
  p_user_id uuid,
  p_task_id uuid,
  p_item_ids text[]
)
returns void
language plpgsql
security invoker
as $$
begin
  update public.mistake_corrections
  set corrected_item_ids = (
        select coalesce(array_agg(id), '{}'::text[])
        from unnest(corrected_item_ids) id
        where id <> all (p_item_ids)
      ),
      failed_attempts = (
        select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
        from jsonb_each(failed_attempts)
        where key <> all (p_item_ids)
      ),
      updated_at = now()
  where user_id = p_user_id and task_id = p_task_id;
end;
$$;

revoke all on function public.clear_mistake_corrections(uuid, uuid, text[]) from public;
grant execute on function public.clear_mistake_corrections(uuid, uuid, text[]) to authenticated, service_role;

notify pgrst, 'reload schema';
