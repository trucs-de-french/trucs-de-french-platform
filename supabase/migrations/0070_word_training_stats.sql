-- ============================================================================
-- "Тренувати мої слова" (/cabinet/dictionary) — студент тренує СВОЇ
-- збережені слова (saved_words) без будь-яких учительських завдань.
-- Результати тренувань НЕ впливають на прогрес курсу, тижневу ціль,
-- streak, activity_log чи досягнення — рахуються лише тут, в окремій
-- таблиці статистики.
--
-- Один рядок на (user_id, saved_word_id) — накопичувальна статистика
-- (attempts/correct), не історія спроб: кожен прогон тренування робить
-- upsert (attempts+1, correct+1 якщо правильно), а не insert нового
-- рядка. last_correct/last_trained_at — для фільтра "Слабкі" (остання
-- відповідь неправильна ЧИ correct/attempts < 0.6) і сортування "давно
-- не тренував" при виборі слів для тренування.
--
-- on delete cascade на saved_word_id: видалення слова зі словника має
-- прибрати й його статистику тренувань (вона без слова безглузда).
--
-- Відкат:
--   drop table public.word_training_stats;
-- ============================================================================

create table public.word_training_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  saved_word_id uuid not null references public.saved_words (id) on delete cascade,
  attempts integer not null default 0 check (attempts >= 0),
  correct integer not null default 0 check (correct >= 0 and correct <= attempts),
  last_correct boolean,
  last_trained_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, saved_word_id)
);

create index word_training_stats_user_idx
  on public.word_training_stats (user_id);

comment on table public.word_training_stats is
  'Статистика тренувань власних слів студента ("Тренувати мої слова", /cabinet/dictionary) — не впливає на прогрес курсу/тижневу ціль/streak/досягнення.';

alter table public.word_training_stats enable row level security;

create policy "word_training_stats_select_own" on public.word_training_stats for select
  using (user_id = auth.uid());

create policy "word_training_stats_insert_own" on public.word_training_stats for insert
  with check (user_id = auth.uid());

create policy "word_training_stats_update_own" on public.word_training_stats for update
  using (user_id = auth.uid());

create policy "word_training_stats_delete_own" on public.word_training_stats for delete
  using (user_id = auth.uid());

grant select, insert, update, delete on public.word_training_stats to authenticated;
grant select, insert, update, delete on public.word_training_stats to service_role;

notify pgrst, 'reload schema';
