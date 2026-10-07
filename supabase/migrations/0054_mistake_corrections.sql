-- ============================================================================
-- mistake_corrections — стан режиму "Робота над помилками" (переробка лише
-- неправильних елементів завдання, БЕЗ балів): які елементи студент уже
-- виправив і скільки невдалих спроб зробив на кожному елементі (щоб правильну
-- відповідь можна було розкрити після другої невдалої спроби, і лічильник
-- переживав оновлення сторінки).
--
-- НЕ чіпає tasks/progress/mistakes/block_progress і RPC record_*: бали,
-- прогрес і лічильник спроб завдань лишаються як були. Поки код застосунку
-- цю таблицю не читає, на прод вона не впливає.
--
-- config_hash — md5(tasks.config::text) на момент запису. У tasks немає
-- updated_at, тож так розпізнається, що вчителька змінила завдання: якщо
-- збережений хеш не збігається з поточним, стан вважається порожнім (нічого
-- не виправлено, лічильники нульові), а наступний запис перезаписує рядок із
-- новим хешем. Хеш рахується в БД (jsonb::text канонічний), не в застосунку.
--
-- corrected_item_ids / ключі failed_attempts — ті самі ідентифікатори
-- елементів, що й в *Detail у grade.ts (blank/word/question/sentence id або
-- індекс як текст), стабільні в межах завдання.
--
-- Відкат: drop function public.save_mistake_correction(uuid, uuid, text[], jsonb);
--         drop function public.get_mistake_correction_state(uuid, uuid);
--         drop table public.mistake_corrections;
-- ============================================================================

create table public.mistake_corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  config_hash text not null,
  corrected_item_ids text[] not null default '{}',
  failed_attempts jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, task_id)
);

alter table public.mistake_corrections enable row level security;

-- Студент бачить і змінює лише свої рядки, вчителька бачить усі й може видаляти.
create policy "mistake_corrections_select" on public.mistake_corrections for select
  using (user_id = auth.uid() or public.is_teacher());

create policy "mistake_corrections_insert_own" on public.mistake_corrections for insert
  with check (user_id = auth.uid());

create policy "mistake_corrections_update_own" on public.mistake_corrections for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "mistake_corrections_teacher_delete" on public.mistake_corrections for delete
  using (public.is_teacher());

grant select, insert, update, delete on public.mistake_corrections to authenticated, service_role;

-- Поточний стан для (студент, завдання): порожній, якщо запису немає або
-- завдання змінилося після запису (інший config_hash).
create or replace function public.get_mistake_correction_state(
  p_user_id uuid,
  p_task_id uuid
)
returns table (corrected_item_ids text[], failed_attempts jsonb)
language sql
stable
security invoker
as $$
  select coalesce(mc.corrected_item_ids, '{}'::text[]),
         coalesce(mc.failed_attempts, '{}'::jsonb)
  from (select md5(t.config::text) as h from public.tasks t where t.id = p_task_id) cur
  left join public.mistake_corrections mc
    on mc.user_id = p_user_id
   and mc.task_id = p_task_id
   and mc.config_hash = cur.h;
$$;

-- Запис стану (upsert) із поточним хешем завдання. Застосунок читає стан,
-- об'єднує зміни й записує повний новий стан. Це режим практики без балів,
-- тож студент впливає лише на власний статус "виправлено".
create or replace function public.save_mistake_correction(
  p_user_id uuid,
  p_task_id uuid,
  p_corrected_item_ids text[],
  p_failed_attempts jsonb
)
returns void
language plpgsql
security invoker
as $$
declare
  v_hash text;
begin
  select md5(t.config::text) into v_hash from public.tasks t where t.id = p_task_id;
  if v_hash is null then
    raise exception 'task % not found', p_task_id;
  end if;

  insert into public.mistake_corrections
    (user_id, task_id, config_hash, corrected_item_ids, failed_attempts, updated_at)
  values
    (p_user_id, p_task_id, v_hash,
     coalesce(p_corrected_item_ids, '{}'::text[]),
     coalesce(p_failed_attempts, '{}'::jsonb),
     now())
  on conflict (user_id, task_id) do update
    set config_hash = excluded.config_hash,
        corrected_item_ids = excluded.corrected_item_ids,
        failed_attempts = excluded.failed_attempts,
        updated_at = now();
end;
$$;

revoke all on function public.get_mistake_correction_state(uuid, uuid) from public;
grant execute on function public.get_mistake_correction_state(uuid, uuid) to authenticated, service_role;

revoke all on function public.save_mistake_correction(uuid, uuid, text[], jsonb) from public;
grant execute on function public.save_mistake_correction(uuid, uuid, text[], jsonb) to authenticated, service_role;

notify pgrst, 'reload schema';
