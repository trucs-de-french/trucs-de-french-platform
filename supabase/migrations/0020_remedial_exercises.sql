-- ============================================================================
-- remedial_exercises: персональні fill_blank-вправи, згенеровані Gemini
-- автоматично після кожної перевірки essay_check, що має errors[]. НЕ через
-- tasks (той принципово спільний авторський контент — tasks_write дозволяє
-- писати лише вчителю; студентський запис туди означав би послаблення цієї
-- політики для всієї таблиці). Один рядок = одна вправа (категорія з двома
-- вправами дає два рядки, review дублюється — дешевше й простіше, ніж
-- окрема таблиця-джойн при такому обсязі даних).
-- ============================================================================

create table public.remedial_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mistake_id uuid not null references public.mistakes (id) on delete cascade,
  category text not null check (
    category in ('Grammaire', 'Lexique', 'Orthographe', 'Cohérence', 'Registre')
  ),
  review text not null,
  config jsonb not null,
  student_answer jsonb,
  score integer,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.remedial_exercises enable row level security;

-- Той самий патерн, що mistakes/progress: студент керує лише своїм,
-- викладач бачить усе.
create policy "remedial_exercises_select" on public.remedial_exercises for select
  using (user_id = auth.uid() or public.is_teacher());
create policy "remedial_exercises_insert" on public.remedial_exercises for insert
  with check (user_id = auth.uid());
create policy "remedial_exercises_update" on public.remedial_exercises for update
  using (user_id = auth.uid());
