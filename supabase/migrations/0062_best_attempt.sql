-- ============================================================================
-- best_score — тримає НАЙКРАЩУ спробу студента поряд з score (яке й далі
-- лишається ОСТАННЬОЮ спробою, поведінка жодного наявного читача score не
-- змінюється). Потрібно для майбутнього сценового BILAN: відсоток/бали
-- сцени мають рахуватись від найкращої спроби кожного завдання, а не від
-- випадкової останньої (студент міг retake-нути гірше, ніж перший раз).
--
-- block_progress (0052) отримує ту саму ідею на рівні КОЖНОГО блоку:
-- bestPointsEarned поряд із pointsEarned (останнім) усередині кожного
-- blockKey-об'єкта. Сума v_sum_best по блоках -> best_score тим самим
-- round(100 * .../p_total_points_possible), що вже рахує v_score.
--
-- Відкат:
--   create or replace function public.record_task_attempt(uuid, uuid, numeric) ...  -- повернути версію з 0007
--   create or replace function public.record_block_task_attempt(uuid, uuid, text, numeric, numeric, numeric) ...  -- повернути версію з 0052
--   alter table public.progress drop column if exists best_score;
-- ============================================================================

alter table public.progress add column if not exists best_score numeric;

-- Бекфіл top-level best_score — для вже існуючих рядків без retake це
-- просто дорівнює поточному score (єдина спроба = найкраща спроба).
update public.progress
set best_score = score
where best_score is null and score is not null;

-- Бекфіл block_progress — додає bestPointsEarned у КОЖЕН блок-об'єкт
-- (fallback на вже наявний pointsEarned, якщо блок перевіряли лише раз).
-- jsonb `||` — шаллоу-мердж, правий операнд перекриває лише ключ
-- bestPointsEarned, pointsEarned/pointsPossible/attempts лишаються як були.
update public.progress p
set block_progress = (
  select jsonb_object_agg(
    kv.key,
    kv.value || jsonb_build_object(
      'bestPointsEarned',
      coalesce(kv.value ->> 'bestPointsEarned', kv.value ->> 'pointsEarned', '0')::numeric
    )
  )
  from jsonb_each(p.block_progress) as kv
)
where p.block_progress is not null and p.block_progress <> '{}'::jsonb;

-- record_task_attempt (0007) — score лишається ОСТАННЬОЮ спробою
-- (excluded.score, без змін); best_score — те саме значення, якщо воно
-- найбільше з досі відомих (greatest проти поточного best_score, а якщо
-- його ще нема — проти поточного score, на випадок рядків, де стовпець
-- щойно додали, а бекфіл вище з якоїсь причини не покрив).
create or replace function public.record_task_attempt(
  p_user_id uuid,
  p_task_id uuid,
  p_score numeric
)
returns void
language sql
security invoker
as $$
  insert into public.progress (user_id, task_id, status, score, best_score, attempts, last_attempt_at)
  values (p_user_id, p_task_id, 'completed', p_score, p_score, 1, now())
  on conflict (user_id, task_id)
  do update set
    status = 'completed',
    score = excluded.score,
    best_score = greatest(coalesce(public.progress.best_score, public.progress.score, 0), excluded.score),
    attempts = public.progress.attempts + 1,
    last_attempt_at = now();
$$;

-- record_block_task_attempt (0052) — та сама атомарна злиттєва логіка, +
-- bestPointsEarned на кожен блок (greatest проти попереднього bestPointsEarned
-- чи, якщо блок іще не мав цього поля, проти його попереднього pointsEarned)
-- і v_sum_best/best_score поряд із незміненими v_sum_earned/score.
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
begin
  insert into public.progress (user_id, task_id, status, score, best_score, attempts, block_progress)
  values (p_user_id, p_task_id, 'in_progress', 0, 0, 0, '{}'::jsonb)
  on conflict (user_id, task_id) do nothing;

  select coalesce(block_progress, '{}'::jsonb) into v_current
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
end;
$$;

notify pgrst, 'reload schema';
