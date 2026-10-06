-- ============================================================================
-- P1 (аудит entrypoints-report.md) — багатоблочні word_search/crossword/
-- matching/table_fill/letter_gaps/letter_rearrangement пишуть ОКРЕМИЙ
-- record_task_attempt на кожне "Перевірити блок" (кожен блок — власний
-- POST /api/exercises/check), а стара record_task_attempt (0007) робить
-- score = excluded.score — ПЕРЕЗАПИС, не агрегацію: у progress лишався
-- відсоток лише ОСТАННЬОГО перевіреного блоку, attempts накручувався на
-- кожен блок замість кожного "проходження".
--
-- block_progress (jsonb, nullable) — мапа "ключ блоку" -> { pointsEarned,
-- pointsPossible, attempts } на кожен уже перевірений блок вправи. Ключ
-- блоку — String(blockIndex) (word_search/crossword — явний
-- answer.blockIndex; matching/table_fill/letter_gaps/letter_rearrangement —
-- позиційний індекс чанка по EXERCISE_BLOCK_SIZE, переданий body.blockIndex
-- з клієнта, exercise-blocks.ts). NULL для будь-якої вправи, що перевіряється
-- одним сабмітом (однаково для одноблочних і всіх типів без блокової
-- перевірки) — record_task_attempt (0007) для них лишається БЕЗ ЗМІН.
--
-- Жодних нових RLS-політик не потрібно: block_progress — просто ще одна
-- колонка існуючої public.progress, уже захищеної record_task_attempt-
-- подібними RPC (security invoker, той самий auth.uid() = user_id, що й
-- наявні policies "progress_select"/"progress_upsert"/"progress_update",
-- 0001_init.sql).
-- ============================================================================

alter table public.progress add column if not exists block_progress jsonb;

-- record_block_task_attempt — окрема RPC для поблочних сабмітів (НЕ заміна
-- record_task_attempt — той і далі обслуговує всі одно-сабмітні типи
-- незмінно). Злиття відбувається в САМІЙ функції (на стороні сервера БД, не
-- в коді застосунку і не на клієнті) — атомарно під одним row-level lock
-- (select ... for update), тож два швидкі послідовні сабміти різних
-- блоків того самого студента не загублять одне одного й не перезатруть
-- block_progress застарілою версією.
--
-- p_block_key — String(blockIndex) з клієнта (route.ts). p_block_points_earned/
-- p_block_points_possible — pointsEarned/pointsPossible ЦЬОГО блоку
-- (grade.ts, уже скоуповані на блок). p_total_points_possible —
-- totalPointsPossible (grade.ts) — ЗАВЖДИ повний знаменник вправи, не блоку
-- (інакше відсоток при НЕ всіх перевірених блоках рахувався б від суми лише
-- вже перевірених часток, а не від усієї вправи — непере­вірені блоки мають
-- рахуватись як 0, не випадати зі знаменника).
--
-- attempts підсумовується як MAX по блоках (не SUM) — перевірка 3 РІЗНИХ
-- блоків по разу = 1 "прохідне" attempts, не 3; повторна перевірка ТОГО Ж
-- блоку збільшує лише його particular attempts у block_progress, і якщо
-- це стає новим максимумом — підіймає й top-level attempts.
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
  v_merged jsonb;
  v_sum_earned numeric;
  v_max_attempts integer;
  v_score numeric;
begin
  insert into public.progress (user_id, task_id, status, score, attempts, block_progress)
  values (p_user_id, p_task_id, 'in_progress', 0, 0, '{}'::jsonb)
  on conflict (user_id, task_id) do nothing;

  select coalesce(block_progress, '{}'::jsonb) into v_current
  from public.progress
  where user_id = p_user_id and task_id = p_task_id
  for update;

  v_block_attempts := coalesce((v_current -> p_block_key ->> 'attempts')::integer, 0) + 1;

  v_merged := jsonb_set(
    v_current,
    array[p_block_key],
    jsonb_build_object(
      'pointsEarned', p_block_points_earned,
      'pointsPossible', p_block_points_possible,
      'attempts', v_block_attempts
    ),
    true
  );

  select coalesce(sum((value ->> 'pointsEarned')::numeric), 0),
         coalesce(max((value ->> 'attempts')::integer), 0)
  into v_sum_earned, v_max_attempts
  from jsonb_each(v_merged);

  v_score := case when p_total_points_possible > 0
    then round(100 * v_sum_earned / p_total_points_possible)
    else 0 end;

  update public.progress
  set status = 'completed',
      score = v_score,
      attempts = v_max_attempts,
      last_attempt_at = now(),
      block_progress = v_merged
  where user_id = p_user_id and task_id = p_task_id;
end;
$$;
