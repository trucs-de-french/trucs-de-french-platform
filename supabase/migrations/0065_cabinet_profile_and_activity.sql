-- ============================================================================
-- Кабінет студента: цілі/профіль (exam_type/exam_date/weekly_goal_scenes на
-- profiles) + журнал РЕАЛЬНИХ перевірених спроб (activity_log) для майбутньої
-- стрічки активності/графіків. Лише практика й виправлення помилок (режими
-- без балів — mistake_corrections, 0054) у журнал НЕ потрапляють: пишуть у
-- нього тільки record_task_attempt і record_block_task_attempt (0063),
-- тобто саме ті викликии, що рахують score/best_score.
--
-- profiles: та сама add column if not exists + inline check, що вже
-- застосовано для ui_lang (0064) — "profiles_update_own" (0062) дозволяє
-- власнику рядка оновлювати будь-яку колонку, крім role, тож нічого
-- окремо правити в RLS не треба.
--
-- activity_log: append-only, клієнт не пише в неї напряму — INSERT робить
-- лише public.record_activity_log(...), SECURITY DEFINER (виконується під
-- власником функції, тобто БЕЗ застосування RLS-політик таблиці), тому в
-- RLS-політиках activity_log немає insert/update/delete для клієнтів взагалі
-- (лише select власних рядків + вчителька). GRANT insert/update/delete
-- authenticated/service_role нижче — це вимога проєкту для Data API
-- (з 30.10 Supabase не видає доступ автоматично), а не дозвіл писати з
-- клієнта: без відповідної RLS-політики ці права не дають жодного ефекту.
--
-- id bigint generated always as identity: власна внутрішня послідовність
-- ідентичності, НЕ окремий serial-sequence — під INSERT через identity-
-- колонку Postgres перевіряє лише INSERT-право на саму таблицю, окремий
-- "grant usage on sequence" тут не потрібен (на відміну від serial/nextval).
--
-- record_task_attempt/record_block_task_attempt: сигнатури, GRANT-и,
-- security invoker і вся попередня поведінка щодо progress — без змін
-- (поточні версії й так SECURITY INVOKER, читаємо з 0063_best_attempt.sql).
-- record_task_attempt переведено з language sql на language plpgsql —
-- потрібно прочитати best_score ДО upsert-а; сам upsert (значення/set-и)
-- лишився ідентичним символ-у-символ. product_id у tasks NOT NULL завжди
-- (0001_init.sql), тож резолв "через сцену" не потрібен узагалі — просто
-- tasks.product_id/tasks.scene_id напряму (scene_id і так nullable).
--
-- Без бекфілу: історія activity_log починається з моменту застосування
-- цієї міграції, старі спроби в неї не потрапляють.
--
-- Відкат:
--   drop function public.record_activity_log(uuid, uuid, numeric, numeric, numeric);
--   create or replace function public.record_task_attempt(uuid, uuid, numeric) ...        -- повернути версію з 0063
--   create or replace function public.record_block_task_attempt(...) ...                  -- повернути версію з 0063
--   drop table public.activity_log;
--   alter table public.profiles drop column if exists exam_type;
--   alter table public.profiles drop column if exists exam_date;
--   alter table public.profiles drop column if exists weekly_goal_scenes;
-- ============================================================================

alter table public.profiles
  add column if not exists exam_type text check (length(exam_type) <= 40);

alter table public.profiles
  add column if not exists exam_date date;

alter table public.profiles
  add column if not exists weekly_goal_scenes smallint not null default 3
  check (weekly_goal_scenes between 1 and 14);

create table public.activity_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  scene_id uuid,
  product_id uuid,
  score numeric not null,
  best_before numeric not null default 0,
  best_after numeric not null,
  created_at timestamptz not null default now()
);

create index activity_log_user_created_idx
  on public.activity_log (user_id, created_at desc);
create index activity_log_user_product_created_idx
  on public.activity_log (user_id, product_id, created_at desc);

alter table public.activity_log enable row level security;

create policy "activity_log_select" on public.activity_log for select
  using (user_id = auth.uid() or public.is_teacher());

grant select, insert, update, delete on public.activity_log to authenticated;
grant select, insert, update, delete on public.activity_log to service_role;

-- Пише один рядок журналу для РЕАЛЬНОЇ перевіреної спроби. SECURITY DEFINER
-- (власник функції, а не роль викликача) — тому вставка проходить, хоч у
-- клієнтських ролей немає жодної insert-політики на activity_log.
-- scene_id/product_id резолвляться тут з tasks: якщо завдання вже видалено
-- між виконанням record_* і цим викликом — просто нічого не вставляє
-- (немає падіння, функція й так у exception-блоці нижче).
create or replace function public.record_activity_log(
  p_user_id uuid,
  p_task_id uuid,
  p_score numeric,
  p_best_before numeric,
  p_best_after numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and p_user_id is distinct from auth.uid() then return; end if;
  insert into public.activity_log (user_id, task_id, scene_id, product_id, score, best_before, best_after)
  select p_user_id, t.id, t.scene_id, t.product_id, p_score, p_best_before, p_best_after
  from public.tasks t
  where t.id = p_task_id;
exception when others then
  -- Запис журналу ніколи не має зламати збереження прогресу.
  null;
end;
$$;

revoke all on function public.record_activity_log(uuid, uuid, numeric, numeric, numeric) from public;
grant execute on function public.record_activity_log(uuid, uuid, numeric, numeric, numeric) to authenticated, service_role;

create or replace function public.record_task_attempt(
  p_user_id uuid,
  p_task_id uuid,
  p_score numeric
)
returns void
language plpgsql
security invoker
as $$
declare
  v_prev_best numeric;
begin
  select coalesce(best_score, score, 0) into v_prev_best
  from public.progress
  where user_id = p_user_id and task_id = p_task_id;
  v_prev_best := coalesce(v_prev_best, 0);

  insert into public.progress (user_id, task_id, status, score, best_score, attempts, last_attempt_at)
  values (p_user_id, p_task_id, 'completed', p_score, p_score, 1, now())
  on conflict (user_id, task_id)
  do update set
    status = 'completed',
    score = excluded.score,
    best_score = greatest(coalesce(public.progress.best_score, public.progress.score, 0), excluded.score),
    attempts = public.progress.attempts + 1,
    last_attempt_at = now();

  perform public.record_activity_log(p_user_id, p_task_id, p_score, v_prev_best, greatest(v_prev_best, p_score));
end;
$$;

create or replace function public.record_block_task_attempt(
  p_user_id uuid,
  p_task_id uuid,
  p_block_key text,
  p_block_points_earned numeric,
  p_block_points_possible numeric,
  p_total_points_possible numeric
)
returns void
language plpgsql
security invoker
as $$
declare
  v_current jsonb;
  v_block_attempts integer;
  v_prev_best numeric;
  v_block_best numeric;
  v_merged jsonb;
  v_sum_earned numeric;
  v_sum_best numeric;
  v_max_attempts integer;
  v_score numeric;
  v_best_score numeric;
  v_task_prev_best numeric;
begin
  insert into public.progress (user_id, task_id, status, score, best_score, attempts, block_progress)
  values (p_user_id, p_task_id, 'in_progress', 0, 0, 0, '{}'::jsonb)
  on conflict (user_id, task_id) do nothing;

  select coalesce(block_progress, '{}'::jsonb), coalesce(best_score, 0)
  into v_current, v_task_prev_best
  from public.progress
  where user_id = p_user_id and task_id = p_task_id
  for update;

  v_block_attempts := coalesce((v_current -> p_block_key ->> 'attempts')::integer, 0) + 1;

  v_prev_best := coalesce(
    (v_current -> p_block_key ->> 'bestPointsEarned')::numeric,
    (v_current -> p_block_key ->> 'pointsEarned')::numeric,
    0
  );
  v_block_best := greatest(v_prev_best, p_block_points_earned);

  v_merged := jsonb_set(
    v_current,
    array[p_block_key],
    jsonb_build_object(
      'pointsEarned', p_block_points_earned,
      'pointsPossible', p_block_points_possible,
      'bestPointsEarned', v_block_best,
      'attempts', v_block_attempts
    ),
    true
  );

  select coalesce(sum((value ->> 'pointsEarned')::numeric), 0),
         coalesce(sum(coalesce((value ->> 'bestPointsEarned')::numeric, (value ->> 'pointsEarned')::numeric, 0)), 0),
         coalesce(max((value ->> 'attempts')::integer), 0)
  into v_sum_earned, v_sum_best, v_max_attempts
  from jsonb_each(v_merged);

  v_score := case when p_total_points_possible > 0
    then round(100 * v_sum_earned / p_total_points_possible)
    else 0 end;
  v_best_score := case when p_total_points_possible > 0
    then round(100 * v_sum_best / p_total_points_possible)
    else 0 end;

  update public.progress
  set status = 'completed',
      score = v_score,
      best_score = v_best_score,
      attempts = v_max_attempts,
      last_attempt_at = now(),
      block_progress = v_merged
  where user_id = p_user_id and task_id = p_task_id;

  perform public.record_activity_log(p_user_id, p_task_id, v_score, v_task_prev_best, v_best_score);
end;
$$;

notify pgrst, 'reload schema';
