-- ============================================================================
-- Журнал спроб теста рівня (/cabinet/placement-test) — один рядок на кожне
-- завершення тесту (включно з результатом A0), для майбутньої аналітики/
-- історії спроб. Нічого з profiles.french_level* тут не змінюється: цей
-- запис додає savePlacementLevel (actions.ts) ПІСЛЯ успішного update
-- профілю, best-effort (помилка вставки логується, але не провалює
-- збереження рівня).
--
-- previous_level: значення profiles.french_level ДО цього оновлення
-- (читається на клієнті з того, що вже показано в кабінеті) — не
-- довіряємо БД-тригеру, бо приймаємо лише вже готовий результат тесту.
--
-- part_scores: jsonb-об'єкт {"A1":7,"A2":6,...} — довільна кількість
-- пройдених частин, не окремі колонки (тест завжди зупиняється на
-- першому незданому рівні, тож довжина варіюється).
--
-- select-політика для вчительки — через наявний public.is_teacher()
-- (0001_init.sql), а не inline exists-запит, щоб лишатись одним
-- джерелом правди для цієї перевірки.
--
-- Без update/delete-політик: журнал append-only для клієнтів.
--
-- Відкат:
--   drop table public.placement_attempts;
-- ============================================================================

create table public.placement_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  level text not null check (level in ('A0', 'A1', 'A2', 'B1', 'B2', 'C1C2')),
  previous_level text check (previous_level in ('A0', 'A1', 'A2', 'B1', 'B2', 'C1C2')),
  grammar_correct int not null check (grammar_correct between 0 and 25),
  vocab_correct int not null check (vocab_correct between 0 and 25),
  part_scores jsonb not null default '{}',
  duration_seconds int check (duration_seconds >= 0)
);

create index placement_attempts_user_created_idx
  on public.placement_attempts (user_id, created_at desc);
create index placement_attempts_created_idx
  on public.placement_attempts (created_at);

alter table public.placement_attempts enable row level security;

create policy "placement_attempts_select_own" on public.placement_attempts for select
  using (user_id = auth.uid() or public.is_teacher());

create policy "placement_attempts_insert_own" on public.placement_attempts for insert
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.placement_attempts to authenticated;
grant select, insert, update, delete on public.placement_attempts to service_role;

notify pgrst, 'reload schema';
